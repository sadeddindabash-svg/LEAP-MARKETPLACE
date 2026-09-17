-- Migration 084: populates the buyer-facing vehicle catalog
-- (vehicle_brands / vehicle_models / vehicle_generations) with real
-- Chinese brands and models -- confirmed with the person, built for
-- their stated goal: a buyer decoding a VIN should be able to
-- actually resolve to a real brand/model/generation record here, not
-- just a decoded string with nothing in the catalog to match against.
--
-- Sourced from the same real, person-provided dataset behind
-- migration 083 (vin_model_patterns) -- only the 69 unambiguous
-- prefixes (single, consistently-confirmed model per prefix) are
-- used here. Overlapping or adjacent real year ranges for the same
-- model are merged into one real generation row; a genuine gap
-- between two real ranges (e.g. Haval H8's 2015 and 2017 data, with
-- nothing confirmed in between) is kept as two separate real
-- generation rows rather than assumed continuous.
--
-- HONEST LIMITATION, confirmed with the person directly: this
-- covers only the 39 models this specific dataset had enough
-- confirmed, unambiguous data for -- not each brand's full real
-- lineup. Built to be added to over time, matching the same real,
-- honest approach as the WMI and model-pattern tables before it.
--
-- HONEST, SEPARATE GAP, confirmed with the person directly and NOT
-- addressed by this migration: no real products are linked to any
-- of these new real generations yet (product_fitment_entries is
-- empty platform-wide, for every brand, not just these new ones) --
-- a real VIN can now resolve all the way to a real generation record
-- here, but "show fit products" still depends on real fitment data
-- this migration does not have and cannot invent.

INSERT INTO vehicle_brands (id, name, sort_order) VALUES
  ('brand_changan', 'Changan', 100),
  ('brand_geely', 'Geely', 101),
  ('brand_haval', 'Haval', 102)
ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicle_models (id, brand_id, name, sort_order) VALUES
  ('model_changan_alsvin_sedan', 'brand_changan', 'Alsvin sedan', 0),
  ('model_changan_benben_e_star', 'brand_changan', 'Benben E-Star', 1),
  ('model_changan_cs15', 'brand_changan', 'CS15', 2),
  ('model_changan_cs15_ev', 'brand_changan', 'CS15 EV', 3),
  ('model_changan_cs35', 'brand_changan', 'CS35', 4),
  ('model_changan_cs35_plus', 'brand_changan', 'CS35 PLUS', 5),
  ('model_changan_cs55', 'brand_changan', 'CS55', 6),
  ('model_changan_cs75', 'brand_changan', 'CS75', 7),
  ('model_changan_cs75_phev', 'brand_changan', 'CS75 PHEV', 8),
  ('model_changan_eado_dt', 'brand_changan', 'Eado DT', 9),
  ('model_changan_eado_et', 'brand_changan', 'Eado ET', 10),
  ('model_changan_eado_plus', 'brand_changan', 'Eado PLUS', 11),
  ('model_changan_uni_t', 'brand_changan', 'UNI-T', 12),
  ('model_changan_uni_v', 'brand_changan', 'UNI-V', 13),
  ('model_geely_binray', 'brand_geely', 'Binray', 0),
  ('model_geely_borui_phev_epro', 'brand_geely', 'Borui PHEV ePro', 1),
  ('model_geely_boyue_l_azkarra_l_atlas_l', 'brand_geely', 'Boyue L/Azkarra L/Atlas L', 2),
  ('model_geely_ec8', 'brand_geely', 'EC8', 3),
  ('model_geely_emgrand_ev', 'brand_geely', 'Emgrand EV', 4),
  ('model_geely_emgrand_gl', 'brand_geely', 'Emgrand GL', 5),
  ('model_geely_emgrand_gs', 'brand_geely', 'Emgrand GS', 6),
  ('model_geely_emgrand_l', 'brand_geely', 'Emgrand L', 7),
  ('model_geely_emgrand_phev', 'brand_geely', 'Emgrand PHEV', 8),
  ('model_geely_emgrand_rs_hatchback', 'brand_geely', 'Emgrand RS Hatchback', 9),
  ('model_geely_emgrand_sedan', 'brand_geely', 'Emgrand Sedan', 10),
  ('model_geely_gx7', 'brand_geely', 'GX7', 11),
  ('model_geely_okavango', 'brand_geely', 'Okavango', 12),
  ('model_geely_okavango_l', 'brand_geely', 'Okavango L', 13),
  ('model_geely_panda_mini', 'brand_geely', 'Panda Mini', 14),
  ('model_geely_tugella_monjaro', 'brand_geely', 'Tugella/Monjaro', 15),
  ('model_geely_icon', 'brand_geely', 'icon', 16),
  ('model_haval_dargo', 'brand_haval', 'Dargo', 0),
  ('model_haval_dargo_hybrid', 'brand_haval', 'Dargo Hybrid', 1),
  ('model_haval_h1_red_label', 'brand_haval', 'H1 red label', 2),
  ('model_haval_h3', 'brand_haval', 'H3', 3),
  ('model_haval_h5', 'brand_haval', 'H5', 4),
  ('model_haval_h6s_hybrid', 'brand_haval', 'H6S hybrid', 5),
  ('model_haval_h8', 'brand_haval', 'H8', 6),
  ('model_haval_h9', 'brand_haval', 'H9', 7)
ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end, sort_order) VALUES
  ('gen_changan_alsvin_sedan_2018_2019', 'model_changan_alsvin_sedan', '2018–2019', 2018, 2019, 0),
  ('gen_changan_benben_e_star_2020_2020', 'model_changan_benben_e_star', '2020', 2020, 2020, 0),
  ('gen_changan_cs15_2016_2021', 'model_changan_cs15', '2016–2021', 2016, 2021, 0),
  ('gen_changan_cs15_ev_2018_2019', 'model_changan_cs15_ev', '2018–2019', 2018, 2019, 0),
  ('gen_changan_cs35_2014_2017', 'model_changan_cs35', '2014–2017', 2014, 2017, 0),
  ('gen_changan_cs35_plus_2019_2022', 'model_changan_cs35_plus', '2019–2022', 2019, 2022, 0),
  ('gen_changan_cs55_2017_2019', 'model_changan_cs55', '2017–2019', 2017, 2019, 0),
  ('gen_changan_cs75_2015_2018', 'model_changan_cs75', '2015–2018', 2015, 2018, 0),
  ('gen_changan_cs75_phev_2019_2019', 'model_changan_cs75_phev', '2019', 2019, 2019, 0),
  ('gen_changan_eado_dt_2018_2018', 'model_changan_eado_dt', '2018', 2018, 2018, 0),
  ('gen_changan_eado_et_2019_2019', 'model_changan_eado_et', '2019', 2019, 2019, 0),
  ('gen_changan_eado_plus_2020_2022', 'model_changan_eado_plus', '2020–2022', 2020, 2022, 0),
  ('gen_changan_uni_t_2020_2023', 'model_changan_uni_t', '2020–2023', 2020, 2023, 0),
  ('gen_changan_uni_v_2022_2025', 'model_changan_uni_v', '2022–2025', 2022, 2025, 0),
  ('gen_geely_binray_2018_2020', 'model_geely_binray', '2018–2020', 2018, 2020, 0),
  ('gen_geely_borui_phev_epro_2021_2022', 'model_geely_borui_phev_epro', '2021–2022', 2021, 2022, 0),
  ('gen_geely_boyue_l_azkarra_l_atlas_l_2024_2024', 'model_geely_boyue_l_azkarra_l_atlas_l', '2024', 2024, 2024, 0),
  ('gen_geely_ec8_2015_2015', 'model_geely_ec8', '2015', 2015, 2015, 0),
  ('gen_geely_emgrand_ev_2021_2022', 'model_geely_emgrand_ev', '2021–2022', 2021, 2022, 0),
  ('gen_geely_emgrand_gl_2017_2020', 'model_geely_emgrand_gl', '2017–2020', 2017, 2020, 0),
  ('gen_geely_emgrand_gs_2017_2017', 'model_geely_emgrand_gs', '2017', 2017, 2017, 0),
  ('gen_geely_emgrand_gs_2019_2019', 'model_geely_emgrand_gs', '2019', 2019, 2019, 1),
  ('gen_geely_emgrand_l_2022_2022', 'model_geely_emgrand_l', '2022', 2022, 2022, 0),
  ('gen_geely_emgrand_phev_2017_2017', 'model_geely_emgrand_phev', '2017', 2017, 2017, 0),
  ('gen_geely_emgrand_rs_hatchback_2015_2017', 'model_geely_emgrand_rs_hatchback', '2015–2017', 2015, 2017, 0),
  ('gen_geely_emgrand_sedan_2022_2022', 'model_geely_emgrand_sedan', '2022', 2022, 2022, 0),
  ('gen_geely_gx7_2014_2014', 'model_geely_gx7', '2014', 2014, 2014, 0),
  ('gen_geely_okavango_2020_2022', 'model_geely_okavango', '2020–2022', 2020, 2022, 0),
  ('gen_geely_okavango_l_2023_2024', 'model_geely_okavango_l', '2023–2024', 2023, 2024, 0),
  ('gen_geely_panda_mini_2023_2025', 'model_geely_panda_mini', '2023–2025', 2023, 2025, 0),
  ('gen_geely_tugella_monjaro_2021_2024', 'model_geely_tugella_monjaro', '2021–2024', 2021, 2024, 0),
  ('gen_geely_icon_2020_2026', 'model_geely_icon', '2020–2026', 2020, 2026, 0),
  ('gen_haval_dargo_2022_2023', 'model_haval_dargo', '2022–2023', 2022, 2023, 0),
  ('gen_haval_dargo_hybrid_2022_2023', 'model_haval_dargo_hybrid', '2022–2023', 2022, 2023, 0),
  ('gen_haval_h1_red_label_2016_2017', 'model_haval_h1_red_label', '2016–2017', 2016, 2017, 0),
  ('gen_haval_h3_2009_2010', 'model_haval_h3', '2009–2010', 2009, 2010, 0),
  ('gen_haval_h5_2013_2025', 'model_haval_h5', '2013–2025', 2013, 2025, 0),
  ('gen_haval_h6s_hybrid_2022_2022', 'model_haval_h6s_hybrid', '2022', 2022, 2022, 0),
  ('gen_haval_h8_2015_2015', 'model_haval_h8', '2015', 2015, 2015, 0),
  ('gen_haval_h8_2017_2017', 'model_haval_h8', '2017', 2017, 2017, 1),
  ('gen_haval_h9_2015_2017', 'model_haval_h9', '2015–2017', 2015, 2017, 0),
  ('gen_haval_h9_2020_2022', 'model_haval_h9', '2020–2022', 2020, 2022, 1)

ON CONFLICT (id) DO NOTHING;
