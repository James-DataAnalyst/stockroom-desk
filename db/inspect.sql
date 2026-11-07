-- Run one SELECT at a time in the stockroom_demo Query Tool.
SELECT current_database() AS database,
       current_setting('server_version') AS postgres_version,
       location, sku, on_hand, reserved, available
FROM stockroom.stock_levels
WHERE location_code = 'IKJ' AND sku = 'BW-750-24';

SELECT (SELECT count(*) FROM stockroom.orders) AS orders,
       (SELECT count(*) FROM stockroom.order_items) AS order_lines,
       (SELECT count(*) FROM stockroom.products) AS products,
       (SELECT count(*) FROM stockroom.customers) AS customers,
       (SELECT count(*) FROM stockroom.movements) AS stock_movements;
