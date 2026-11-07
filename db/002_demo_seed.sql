INSERT INTO warehouses (id, code, name) VALUES
  (1, 'IKJ', 'Ikeja Main'),
  (2, 'LKK', 'Lekki Hub');

INSERT INTO products (id, sku, name, pack, category, unit_price, reorder_point)
SELECT id, sku, name, pack, category, naira * 100, 5 + id % 7
FROM (VALUES
  (1,'BW-750-24','Still water 750 ml','Carton of 24','Drinks',6600),
  (2,'BW-500-24','Still water 500 ml','Carton of 24','Drinks',4300),
  (3,'BW-1500-12','Still water 1.5 L','Carton of 12','Drinks',5700),
  (4,'SW-330-24','Sparkling water 330 ml','Case of 24','Drinks',11400),
  (5,'JU-ORG-12','Orange juice 1 L','Case of 12','Drinks',25400),
  (6,'JU-PIN-12','Pineapple juice 1 L','Case of 12','Drinks',24200),
  (7,'JU-MNG-24','Mango drink 250 ml','Case of 24','Drinks',15800),
  (8,'SD-GIN-24','Ginger soda 330 ml','Case of 24','Drinks',12500),
  (9,'SD-LEM-24','Lemon soda 330 ml','Case of 24','Drinks',12800),
  (10,'TE-BLK-12','Black tea 50 bags','Box of 12','Tea & coffee',17800),
  (11,'TE-GRN-12','Green tea 25 bags','Box of 12','Tea & coffee',16600),
  (12,'TE-HIB-12','Hibiscus tea 25 bags','Box of 12','Tea & coffee',18100),
  (13,'CF-INS-12','Instant coffee 100 g','Tray of 12','Tea & coffee',38800),
  (14,'CF-MED-06','Medium roast coffee 250 g','Box of 6','Tea & coffee',35400),
  (15,'CF-DRK-06','Dark roast coffee 250 g','Box of 6','Tea & coffee',36700),
  (16,'PK-RIC-05','Long-grain rice 5 kg','Bundle of 5','Pantry',49300),
  (17,'PK-RIB-10','Brown rice 1 kg','Box of 10','Pantry',23600),
  (18,'PK-BEA-10','Brown beans 1 kg','Box of 10','Pantry',27900),
  (19,'PK-LEN-12','Red lentils 500 g','Box of 12','Pantry',24700),
  (20,'PK-FLR-10','Plain flour 1 kg','Bundle of 10','Pantry',16800),
  (21,'PK-OAT-10','Rolled oats 500 g','Box of 10','Pantry',19300),
  (22,'PK-PAE-12','Penne 500 g','Box of 12','Pantry',15200),
  (23,'PK-SPG-20','Spaghetti 500 g','Case of 20','Pantry',21900),
  (24,'PK-OIL-12','Sunflower oil 1 L','Case of 12','Pantry',41600),
  (25,'PK-SAL-20','Iodised salt 500 g','Bundle of 20','Pantry',11300),
  (26,'PK-TOM-24','Tomato paste 210 g','Case of 24','Pantry',17400),
  (27,'PK-SUG-10','Granulated sugar 1 kg','Bundle of 10','Pantry',19500),
  (28,'SN-PLN-24','Plantain crisps 60 g','Case of 24','Snacks',12200),
  (29,'SN-CAS-12','Roasted cashews 150 g','Case of 12','Snacks',24600),
  (30,'SN-GRN-24','Groundnuts 100 g','Case of 24','Snacks',14100),
  (31,'SN-CRK-20','Water crackers 150 g','Case of 20','Snacks',17800),
  (32,'SN-BIS-24','Oat biscuits 120 g','Case of 24','Snacks',18500),
  (33,'SN-POC-20','Salted popcorn 55 g','Case of 20','Snacks',10500),
  (34,'SN-GRA-24','Granola bars 45 g','Case of 24','Snacks',21000),
  (35,'SN-COK-16','Ginger cookies 200 g','Case of 16','Snacks',16800),
  (36,'SN-CCH-24','Coconut chips 40 g','Case of 24','Snacks',15700),
  (37,'CL-DIS-12','Dishwashing liquid 500 ml','Case of 12','Cleaning',14900),
  (38,'CL-DSB-06','Dishwashing liquid 5 L','Case of 6','Cleaning',40800),
  (39,'CL-ALL-12','Multi-surface cleaner 1 L','Case of 12','Cleaning',22900),
  (40,'CL-LAU-08','Laundry powder 1 kg','Bundle of 8','Cleaning',24700),
  (41,'CL-GLS-12','Glass cleaner 500 ml','Case of 12','Cleaning',17300),
  (42,'CL-BLE-12','Bleach 750 ml','Case of 12','Cleaning',12100),
  (43,'CL-SPN-20','Kitchen sponges 3 pack','Case of 20','Cleaning',9800),
  (44,'CL-GLV-12','Reusable cleaning gloves','Box of 12 pairs','Cleaning',13200),
  (45,'CL-FLR-04','Floor cleaner 5 L','Case of 4','Cleaning',28200),
  (46,'PP-TIS-12','Toilet tissue 4 roll pack','Case of 12 packs','Paper goods',21500),
  (47,'PP-NPK-24','White napkins 100 pack','Case of 24 packs','Paper goods',21700),
  (48,'PP-KTW-12','Kitchen towel 2 roll pack','Case of 12 packs','Paper goods',25100),
  (49,'PP-FCL-24','Facial tissues 100 sheets','Case of 24 boxes','Paper goods',28100),
  (50,'PP-RCP-50','Thermal receipt rolls','Box of 50 rolls','Paper goods',17400),
  (51,'PP-BAG-50','Kraft shopping bags medium','Pack of 50','Packaging',6200),
  (52,'PP-BGL-50','Kraft shopping bags large','Pack of 50','Packaging',8500),
  (53,'CT-750-50','Kraft takeaway box 750 ml','Pack of 50','Packaging',9400),
  (54,'CT-1000-50','Kraft takeaway box 1 L','Pack of 50','Packaging',11300),
  (55,'CT-500-50','Clear deli container 500 ml','Pack of 50','Packaging',7300),
  (56,'CT-CUP-100','Paper cups 250 ml','Pack of 100','Packaging',8200),
  (57,'CT-LID-100','Paper cup lids 250 ml','Pack of 100','Packaging',5700),
  (58,'CT-BWL-50','Paper salad bowls 1 L','Pack of 50','Packaging',12500),
  (59,'CT-FIL-12','Food wrap 30 m','Case of 12 rolls','Packaging',15800),
  (60,'CT-FOL-12','Aluminium foil 20 m','Case of 12 rolls','Packaging',18500),
  (61,'CT-TAP-24','Packing tape 48 mm','Box of 24 rolls','Packaging',14300),
  (62,'PC-HND-12','Hand wash 500 ml','Case of 12','Personal care',16800),
  (63,'PC-SAP-24','Unscented soap 125 g','Case of 24','Personal care',18600),
  (64,'PC-TOO-24','Toothpaste 125 ml','Case of 24','Personal care',27400),
  (65,'PC-BRU-24','Soft toothbrush','Case of 24','Personal care',14400),
  (66,'PC-LTN-12','Body lotion 250 ml','Case of 12','Personal care',28500),
  (67,'PC-SHA-12','Shampoo 300 ml','Case of 12','Personal care',31700),
  (68,'PC-HYG-12','Hand sanitiser 500 ml','Case of 12','Personal care',19500),
  (69,'PC-WIP-12','Baby wipes 80 sheets','Case of 12 packs','Personal care',22900),
  (70,'PC-LIP-24','Lip balm 4 g','Box of 24','Personal care',18600),
  (71,'CL-BIN-24','Bin liners 20 roll pack','Case of 24 packs','Cleaning',27100),
  (72,'SD-COL-24','Cola 330 ml','Case of 24','Drinks',11400)
) AS p(id, sku, name, pack, category, naira);

INSERT INTO customers (id, name, channel) VALUES
  (1, 'Maple Corner Stores', 'Retail'),
  (2, 'Bayside Mini Mart', 'Retail');

WITH names AS (
  SELECT ARRAY['Acacia','Adebayo','Ashfield','Aster','Blue Cedar','Bridgeway','Brookline','Cedar Crest',
    'Coral Bay','Crestview','Dove Court','Eastgate','Elmwood','Evergreen','Fairhaven','Garden Walk',
    'Green Terrace','Harbourview','Ivy Court','Juniper','Kingsfield','Lakeview','Linden','Meadowbrook',
    'North Bank','Olive Branch','Palm Grove','Pine Terrace','Riverstone','Silver Birch'] AS prefixes,
    ARRAY['Mini Mart','Retail','Food Services','Market','Grocers','Supply'] AS suffixes
)
INSERT INTO customers (id, name, channel)
SELECT n, prefixes[(n-3) % 30 + 1] || ' ' || suffixes[(n-3) / 30 + 1],
  (ARRAY['Retail','Online','Wholesale','Retail','Retail','Wholesale'])[(n-3) / 30 + 1]
FROM generate_series(3, 180) AS n CROSS JOIN names;

WITH dated AS (
  SELECT n AS id, 1 + (n * 67 % 180) AS customer_id,
    CASE WHEN n % 7 < 2 THEN 2 ELSE 1 END AS warehouse_id,
    GREATEST(0, floor((2400-n)*124.0/2400 + 2.3*sin((2400-n)/80.0) + .5*sin((2400-n)/15.0)))::int AS age,
    (now() AT TIME ZONE 'Africa/Lagos')::date AS today
  FROM generate_series(1, 2400) AS n
), timings AS (
  SELECT *,
    LEAST(now() - interval '30 minutes',
      (today - age + interval '8 hours' + (id * 29 % 600) * interval '1 minute') AT TIME ZONE 'Africa/Lagos') AS placed,
    CASE WHEN age >= 9 THEN CASE WHEN id % 17 = 0 THEN 'cancelled' ELSE 'dispatched' END
         WHEN id % 5 < 2 THEN 'waiting'
         WHEN id % 5 < 4 THEN 'reserved' ELSE 'dispatched' END AS stage
  FROM dated
)
INSERT INTO orders (id, customer_id, warehouse_id, status, channel, due_on, placed_at, reserved_at, dispatched_at, cancelled_at)
SELECT t.id, t.customer_id, t.warehouse_id, t.stage, c.channel, t.today - t.age + 1 + (t.id % 4), t.placed,
  CASE WHEN t.stage IN ('reserved','dispatched') THEN t.placed + interval '15 minutes' END,
  CASE WHEN t.stage = 'dispatched' THEN LEAST(now(), t.placed + (3 + t.id % 44) * interval '1 hour') END,
  CASE WHEN t.stage = 'cancelled' THEN t.placed + interval '3 hours' END
FROM timings t JOIN customers c ON c.id = t.customer_id;

INSERT INTO orders (id, customer_id, warehouse_id, status, channel, due_on, placed_at, reserved_at, note)
VALUES (2401, 2, 1, 'reserved', 'Retail', (now() AT TIME ZONE 'Africa/Lagos')::date,
  now() - interval '55 minutes', now() - interval '45 minutes', 'Eight cartons set aside for the morning pickup.');

INSERT INTO order_items (order_id, product_id, quantity, unit_price)
SELECT o.id, p.id, CASE WHEN o.status = 'waiting' THEN 6 + (o.id % 8)
                       WHEN o.channel = 'Wholesale' THEN 6 + ((o.id * 3 + l.n) % 16)
                       ELSE 1 + ((o.id + l.n * 3) % 8) END,
  CASE WHEN o.channel = 'Wholesale' THEN p.unit_price * 95 / 100 ELSE p.unit_price END
FROM orders o CROSS JOIN LATERAL generate_series(1, 1 + (o.id % 4)) AS l(n)
JOIN products p ON p.id = CASE WHEN o.status = 'waiting' THEN 6 * (1 + (o.id + l.n) % 12)
                              ELSE 2 + (o.id * 17 + l.n * 13) % 71 END
WHERE o.id <= 2400;

INSERT INTO order_items (order_id, product_id, quantity, unit_price)
SELECT 2401, id, 8, unit_price FROM products WHERE sku = 'BW-750-24';

WITH allocated AS (
  SELECT o.warehouse_id, oi.product_id, sum(oi.quantity)::int AS units
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status = 'reserved' GROUP BY o.warehouse_id, oi.product_id
)
INSERT INTO inventory (warehouse_id, product_id, on_hand, reserved)
SELECT w.id, p.id, coalesce(a.units, 0) +
  CASE WHEN w.id = 1 AND p.id = 1 THEN 4
       WHEN p.id % 6 = 0 THEN (p.id + w.id) % 4
       ELSE 16 + (p.id * 13 + w.id * 11) % 86 END, coalesce(a.units, 0)
FROM warehouses w CROSS JOIN products p
LEFT JOIN allocated a ON a.warehouse_id = w.id AND a.product_id = p.id;

WITH shipped AS (
  SELECT o.warehouse_id, oi.product_id, sum(oi.quantity)::int AS units
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status = 'dispatched' GROUP BY o.warehouse_id, oi.product_id
)
INSERT INTO movements (warehouse_id, product_id, kind, on_hand_delta, reserved_delta, reference, created_at)
SELECT i.warehouse_id, i.product_id, 'opening', i.on_hand + coalesce(s.units, 0), 0,
  'Opening count', now() - interval '135 days'
FROM inventory i LEFT JOIN shipped s ON s.warehouse_id = i.warehouse_id AND s.product_id = i.product_id
WHERE i.on_hand + coalesce(s.units, 0) > 0;

INSERT INTO movements (warehouse_id, product_id, order_id, kind, on_hand_delta, reserved_delta, created_at)
SELECT o.warehouse_id, oi.product_id, o.id, 'reserve', 0, oi.quantity, o.reserved_at
FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.reserved_at IS NOT NULL;

INSERT INTO movements (warehouse_id, product_id, order_id, kind, on_hand_delta, reserved_delta, created_at)
SELECT o.warehouse_id, oi.product_id, o.id, 'dispatch', -oi.quantity, -oi.quantity, o.dispatched_at
FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.dispatched_at IS NOT NULL;

INSERT INTO order_events (order_id, kind, created_at)
SELECT id, 'created', placed_at FROM orders
UNION ALL SELECT id, 'reserved', reserved_at FROM orders WHERE reserved_at IS NOT NULL
UNION ALL SELECT id, 'dispatched', dispatched_at FROM orders WHERE dispatched_at IS NOT NULL
UNION ALL SELECT id, 'cancelled', cancelled_at FROM orders WHERE cancelled_at IS NOT NULL;

SELECT setval(pg_get_serial_sequence('orders', 'id'), (SELECT max(id) FROM orders));
SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT max(id) FROM products));
SELECT setval(pg_get_serial_sequence('customers', 'id'), (SELECT max(id) FROM customers));
SELECT setval(pg_get_serial_sequence('warehouses', 'id'), (SELECT max(id) FROM warehouses));
