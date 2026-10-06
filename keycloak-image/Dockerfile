FROM quay.io/keycloak/keycloak:26.1.4

USER root

COPY --from=public.ecr.aws/lambda/python:3.11 /usr/local/bin/aws-lambda-rie /usr/local/bin/aws-lambda-rie
RUN chmod +x /usr/local/bin/aws-lambda-rie

ENV KC_DB=postgres \
    KC_DB_URL=jdbc:postgresql://YOUR_RDS_ENDPOINT:5432/keycloak \
    KC_DB_USERNAME=keycloak \
    KC_DB_PASSWORD=YOUR_DB_PASSWORD \
    KC_HOSTNAME=kds.yourdomain.com \
    KC_PROXY=edge \
    KC_HTTP_ENABLED=true \
    KC_BOOTSTRAP_ADMIN_USERNAME=admin \
    KC_BOOTSTRAP_ADMIN_PASSWORD=admin123 \
    KC_HTTP_PORT=8080

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/aws-lambda-rie", "/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized"]
