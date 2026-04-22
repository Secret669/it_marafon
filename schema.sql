-- ================================================================
-- АгроФорма — MySQL schema
-- Сумісно з MySQL 8.0+ (JSON column, utf8mb4)
-- ================================================================

CREATE DATABASE IF NOT EXISTS agroforma
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE agroforma;

-- ----------------------------------------------------------------
-- Форми (одна форма = один заповнений бланк)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS forms (
  id         INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  module     VARCHAR(20)     NOT NULL COMMENT 'crop | swine | bulls | dairy',
  name       VARCHAR(255)    NOT NULL,
  data       JSON            NOT NULL DEFAULT (JSON_OBJECT()),
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_module (module),
  INDEX idx_updated (updated_at)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- Постійні значення combobox-ів
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cb_options (
  id         INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  opt_key    VARCHAR(100)    NOT NULL,
  value      VARCHAR(500)    NOT NULL,
  is_system  TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '1 = значення за замовчуванням, не видаляється',
  sort_order INT             NOT NULL DEFAULT 0,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_key_val (opt_key, value(255)),
  INDEX idx_key (opt_key)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- Стандартні значення combobox-ів
-- ----------------------------------------------------------------
INSERT IGNORE INTO cb_options (opt_key, value, is_system, sort_order) VALUES
  -- Регіони
  ('regions','Полтавський р-н, Полтавська обл.',1,10),
  ('regions','Харківський р-н, Харківська обл.',1,20),
  ('regions','Київський р-н, Київська обл.',   1,30),
  ('regions','Одеський р-н, Одеська обл.',     1,40),
  ('regions','Вінницький р-н, Вінницька обл.',  1,50),
  -- Орг.-правова форма
  ('orgforms','ФГ (фермерське господарство)',1,10),
  ('orgforms','ТОВ',1,20),
  ('orgforms','ПП', 1,30),
  ('orgforms','ВАТ',1,40),
  ('orgforms','СТОВ',1,50),
  ('orgforms','Фізична особа-підприємець',1,60),
  -- Спеціалізація
  ('specs','Рослинництво',       1,10),
  ('specs','Тваринництво',       1,20),
  ('specs','Змішане виробництво',1,30),
  ('specs','Молочне скотарство', 1,40),
  ('specs','М''ясне скотарство', 1,50),
  ('specs','Свинарство',         1,60),
  -- Система вирощування
  ('growsys','conventional farming',1,10),
  ('growsys','organic farming',     1,20),
  ('growsys','integrated farming',  1,30),
  -- Валюти
  ('currencies','грн',1,10),
  ('currencies','€',  1,20),
  ('currencies','$',  1,30),
  ('currencies','PLN',1,40),
  -- Культури
  ('crops','Пшениця озима',     1,10),
  ('crops','Кукурудза на зерно',1,20),
  ('crops','Ріпак озимий',      1,30),
  ('crops','Соняшник',          1,40),
  ('crops','Ячмінь ярий',       1,50),
  ('crops','Соя',               1,60),
  ('crops','Цукровий буряк',    1,70),
  ('crops','Кукурудза на силос',1,80),
  ('crops','Люцерна на сінаж',  1,90),
  ('crops','Люцерна на сіно',   1,100);
