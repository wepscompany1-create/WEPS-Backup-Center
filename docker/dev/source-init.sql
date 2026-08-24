CREATE TABLE IF NOT EXISTS sample_records (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL
);

INSERT INTO sample_records (label) VALUES ('dev-sample');
