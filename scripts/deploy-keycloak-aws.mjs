// Despliega (o actualiza) Keycloak en ECS Fargate con los realms de cada empresa.
//   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... node scripts/deploy-keycloak-aws.mjs
// Opcional: KC_ADMIN_PASSWORD (si no, se genera una al azar y se imprime una sola vez al crear el stack).
// Usa el aws-sdk instalado en backend/ (no hay aws CLI). Fase 1: red + ALB + CloudFront con 0 tareas;
// fase 2: con el dominio ya conocido arranca Keycloak con ese hostname.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AWS = createRequire(path.join(root, 'backend/package.json'))('aws-sdk');
const region = process.env.AWS_REGION ?? 'us-east-1';
const STACK = 'kds-keycloak';
const ec2 = new AWS.EC2({ region });
const cfn = new AWS.CloudFormation({ region });
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);

// Los realms de AWS salen de los mismos archivos que usa el Keycloak local, sin el login por contraseña directo.
const realm = (t) => {
  const r = JSON.parse(readFileSync(path.join(root, `security-service/keycloak/kds-${t}-realm.json`), 'utf8'));
  r.clients.forEach((c) => {
    c.directAccessGrantsEnabled = false;
  });
  return Buffer.from(JSON.stringify(r)).toString('base64');
};
const template = readFileSync(path.join(root, 'infra/keycloak-ecs.yml'), 'utf8')
  .replace('__REALM_STARPIZZA__', realm('starpizza'))
  .replace('__REALM_DELAROSEPIZZA__', realm('delarosepizza'));

const vpc = (await ec2.describeVpcs({ Filters: [{ Name: 'isDefault', Values: ['true'] }] }).promise()).Vpcs[0];
const subnets = (
  await ec2
    .describeSubnets({ Filters: [{ Name: 'vpc-id', Values: [vpc.VpcId] }, { Name: 'map-public-ip-on-launch', Values: ['true'] }] })
    .promise()
).Subnets;
const subnetIds = [...new Map(subnets.map((s) => [s.AvailabilityZone, s.SubnetId])).values()].slice(0, 2);
const prefixList = (
  await ec2
    .describeManagedPrefixLists({ Filters: [{ Name: 'prefix-list-name', Values: ['com.amazonaws.global.cloudfront.origin-facing'] }] })
    .promise()
).PrefixLists[0].PrefixListId;
log('VPC', vpc.VpcId, '· subredes', subnetIds.join(','), '· prefix list', prefixList);

const describe = async () => (await cfn.describeStacks({ StackName: STACK }).promise().catch(() => ({ Stacks: [] }))).Stacks[0];
const keep = (k) => ({ ParameterKey: k, UsePreviousValue: true });
const baseParams = [
  { ParameterKey: 'VpcId', ParameterValue: vpc.VpcId },
  { ParameterKey: 'SubnetIds', ParameterValue: subnetIds.join(',') },
  { ParameterKey: 'CloudFrontPrefixListId', ParameterValue: prefixList },
];

async function apply(extra) {
  const args = { StackName: STACK, TemplateBody: template, Capabilities: ['CAPABILITY_IAM'], Parameters: [...baseParams, ...extra] };
  try {
    if (!(await describe())) {
      await cfn.createStack(args).promise();
      await cfn.waitFor('stackCreateComplete', { StackName: STACK }).promise();
    } else {
      await cfn.updateStack(args).promise();
      await cfn.waitFor('stackUpdateComplete', { StackName: STACK }).promise();
    }
  } catch (e) {
    if (/No updates are to be performed/.test(e.message)) return log('sin cambios');
    const events = (await cfn.describeStackEvents({ StackName: STACK }).promise().catch(() => ({ StackEvents: [] }))).StackEvents;
    events.filter((x) => /FAILED/.test(x.ResourceStatus)).slice(0, 5).forEach((x) => console.log('  ✗', x.LogicalResourceId, x.ResourceStatusReason));
    throw e;
  }
}

let adminPassword;
if (!(await describe())) {
  adminPassword = process.env.KC_ADMIN_PASSWORD ?? randomBytes(15).toString('base64url');
  log('Fase 1: creando red, ALB y CloudFront (≈5-10 min, CloudFront es lento)…');
  await apply([
    { ParameterKey: 'AdminPassword', ParameterValue: adminPassword },
    { ParameterKey: 'DesiredCount', ParameterValue: '0' },
  ]);
}
const domain = (await describe()).Outputs.find((o) => o.OutputKey === 'CloudFrontDomain').OutputValue;
const url = `https://${domain}`;
log('Fase 2: arrancando Keycloak con hostname', url);
await apply([
  adminPassword ? { ParameterKey: 'AdminPassword', ParameterValue: adminPassword } : keep('AdminPassword'),
  { ParameterKey: 'KeycloakUrl', ParameterValue: url },
  { ParameterKey: 'DesiredCount', ParameterValue: '1' },
]);

log('Esperando a que Keycloak responda (el primer arranque tarda 2-4 min)…');
let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  const r = await fetch(`${url}/realms/kds-starpizza/.well-known/openid-configuration`).catch(() => null);
  if (r?.ok) {
    ready = true;
    console.log(`\nKEYCLOAK LISTO: ${url}\nIssuer StarPizza : ${(await r.json()).issuer}`);
  } else await new Promise((res) => setTimeout(res, 10_000));
}
if (!ready) console.log('Aún no responde; revisa los logs en CloudWatch (/ecs/kds-keycloak).');
if (adminPassword) console.log(`\nConsola de administración: ${url}/admin · usuario admin · contraseña: ${adminPassword}\n(guárdala: no se vuelve a mostrar)`);
