-- One PostgreSQL server, a separate database for every service. Run by the db-init service in
-- docker-compose.yml on every start; creates only the databases that are missing, so it is safe to repeat.
SELECT 'CREATE DATABASE identity'  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'identity')  \gexec
SELECT 'CREATE DATABASE catalog'   WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'catalog')   \gexec
SELECT 'CREATE DATABASE community' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'community') \gexec
