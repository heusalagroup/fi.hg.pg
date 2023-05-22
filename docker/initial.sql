
--
-- Table structure for table prefix_foos
--

DROP TABLE IF EXISTS prefix_foos;
CREATE TABLE prefix_foos (
  foo_id BIGSERIAL PRIMARY KEY,
  foo_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  foo_name varchar(255) NOT NULL default '',
  non_updatable VARCHAR(255) NOT NULL default ''
);

--
-- Table structure for table prefix_bars
--

DROP TABLE IF EXISTS prefix_bars;
CREATE TABLE prefix_bars (
  bar_id BIGSERIAL PRIMARY KEY,
  bar_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  bar_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  bar_name varchar(255) NOT NULL default ''
);

--
-- Table structure for table carts
--

DROP TABLE IF EXISTS prefix_carts;
CREATE TABLE prefix_carts (
  cart_id BIGSERIAL PRIMARY KEY,
  cart_name varchar(255) NOT NULL default ''
);

--
-- Table structure for table contacts
--

DROP TABLE IF EXISTS prefix_contacts;
CREATE TABLE prefix_contacts (
  contact_id BIGSERIAL PRIMARY KEY,
  cart_id BIGINT NOT NULL,
  contact_name varchar(255) NOT NULL default ''
);

--
-- Table structure for table cart_items
--

DROP TABLE IF EXISTS prefix_cart_items;
CREATE TABLE prefix_cart_items (
  cart_item_id BIGSERIAL PRIMARY KEY,
  cart_id BIGINT NOT NULL,
  cart_item_name varchar(255) NOT NULL default ''
);

--
-- Table structure for table prefix_type_test_json_data
--

DROP TABLE IF EXISTS prefix_type_test_json_data;
CREATE TABLE prefix_type_test_json_data (
  data_id BIGSERIAL PRIMARY KEY,
  data_json JSON NOT NULL
);

--
-- Table structure for table prefix_type_test_jsonb_data
--

DROP TABLE IF EXISTS prefix_type_test_jsonb_data;
CREATE TABLE prefix_type_test_jsonb_data (
  data_id BIGSERIAL PRIMARY KEY,
  data_json JSONB NOT NULL
);
