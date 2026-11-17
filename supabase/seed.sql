insert into public.business_profiles (name, phone, email, address, invoice_note)
values ('Azura Makeup Studio', '0812 9000 2026', 'hello@azuramakeup.id', 'Jakarta Selatan, DKI Jakarta', 'Terima kasih telah mempercayakan momen spesial Anda kepada Azura Makeup Studio.');

insert into public.catalog_items (name, type, description, catalog_price, unit) values
('Makeup Wedding', 'core', 'Complete bridal makeup dengan complexion tahan lama.', 2500000, 'orang'),
('Makeup Engagement', 'core', 'Soft glam elegan untuk acara engagement.', 1500000, 'orang'),
('Makeup Graduation', 'core', 'Fresh makeup untuk momen wisuda.', 750000, 'orang'),
('Makeup Keluarga', 'additional', 'Makeup natural untuk keluarga pengantin.', 500000, 'orang'),
('Hairdo', 'additional', 'Hair styling menyesuaikan konsep acara.', 350000, 'orang'),
('Touch Up', 'additional', 'Pendampingan dan touch up selama acara.', 600000, 'sesi');

insert into public.inventory_items (name, category, unit, initial_quantity, minimum_stock, storage_location) values
('Foundation HD', 'Complexion', 'botol', 6, 4, 'Drawer A1'),
('Setting Spray', 'Finishing', 'botol', 3, 3, 'Drawer A2'),
('False Lashes', 'Accessories', 'pasang', 12, 8, 'Box B1'),
('Cleansing Balm', 'Skin Prep', 'jar', 2, 2, 'Drawer A3'),
('Beauty Sponge', 'Tools', 'pcs', 10, 5, 'Box B2');

insert into public.wedding_attire (name, category, size, status, notes) values
('Kebaya Sekar Arum', 'bride', 'M', 'available', 'Set kebaya dan kain.'),
('Kebaya Ayu Ratih', 'bride', 'L', 'booked', 'Warna champagne.'),
('Paes Ageng Velvet', 'bride', 'S', 'laundry', 'Set adat lengkap.'),
('Beskap Gading', 'groom', 'L', 'available', 'Beskap, kain, dan blangkon.'),
('Beskap Surjan Navy', 'groom', 'XL', 'available', 'Set surjan modern.'),
('Beskap Klasik Hitam', 'groom', 'M', 'laundry', 'Set klasik hitam dan emas.');
