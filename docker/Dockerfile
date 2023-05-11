ARG POSTGRES_IMAGE=postgres:15

FROM $POSTGRES_IMAGE as postgres-image

FROM postgres-image
COPY initial.sql /docker-entrypoint-initdb.d
