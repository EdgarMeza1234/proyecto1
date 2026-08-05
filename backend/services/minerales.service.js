const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'minerales.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mineral_precios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mineral TEXT NOT NULL UNIQUE,
      precio REAL NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now', '-4 hours'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS mineral_compras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nro_lote TEXT NOT NULL,
      fecha_entrega TEXT NOT NULL,
      fecha_liquidacion TEXT NOT NULL,
      nombre_productor TEXT NOT NULL,
      cooperativa TEXT DEFAULT '',
      tipo_cambio REAL NOT NULL DEFAULT 8.5,
      tc_oficial REAL NOT NULL DEFAULT 6.96,
      peso_bruto REAL NOT NULL,
      tara REAL NOT NULL,
      peso_neto REAL NOT NULL,
      h2o REAL NOT NULL DEFAULT 0,
      ley_pb REAL NOT NULL DEFAULT 0,
      ley_ag REAL NOT NULL DEFAULT 0,
      ley_zn REAL NOT NULL DEFAULT 0,
      precio_pb REAL NOT NULL DEFAULT 0,
      precio_ag REAL NOT NULL DEFAULT 0,
      precio_zn REAL NOT NULL DEFAULT 0,
      precio_por_tn REAL NOT NULL,
      ley_porcentaje REAL NOT NULL DEFAULT 0.07,
      tmns REAL NOT NULL,
      kl_finos REAL NOT NULL,
      lb_finas REAL NOT NULL,
      val_min_usd REAL NOT NULL,
      val_min_bs REAL NOT NULL,
      caja REAL NOT NULL DEFAULT 1.8,
      comibol REAL NOT NULL DEFAULT 1,
      fedecomin REAL NOT NULL DEFAULT 0.7,
      wisterman REAL NOT NULL DEFAULT 0.3,
      fencomin REAL NOT NULL DEFAULT 0.4,
      regalia_zn_ag REAL NOT NULL DEFAULT 6,
      anticipos REAL NOT NULL DEFAULT 0,
      transporte REAL NOT NULL DEFAULT 0,
      porcentaje_bs REAL NOT NULL DEFAULT 0,
      diesel_topes REAL NOT NULL DEFAULT 0,
      total_retenciones REAL NOT NULL,
      sub_total_bs REAL NOT NULL,
      liquido_pagable_bs REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now', '-4 hours'))
    )
  `);
  const count = db.prepare('SELECT COUNT(*) as c FROM mineral_precios').get();
  if (count.c === 0) {
    const insert = db.prepare('INSERT OR IGNORE INTO mineral_precios (mineral, precio) VALUES (?, ?)');
    insert.run('PB', 0);
    insert.run('AG', 0);
    insert.run('ZN', 19.5);
  }
}

function calcular(data) {
  const pesoNeto = data.peso_bruto - data.tara;
  const tmns = pesoNeto * (1 - data.h2o);
  const precioPorTn = (data.ley_pb * data.precio_pb) + (data.ley_ag * data.precio_ag) + (data.ley_zn * data.precio_zn);
  const klFinos = tmns * data.ley_porcentaje;
  const lbFinas = klFinos * 2.2046223;
  const valMinUsd = (precioPorTn * tmns) / 1000;
  const valMinBs = valMinUsd * data.tipo_cambio;
  const totalRetenciones = valMinBs * (data.caja + data.comibol + data.fedecomin + data.wisterman + data.fencomin + data.regalia_zn_ag) / 100;
  const subTotalBs = valMinBs - totalRetenciones;
  const liquidoPagable = subTotalBs - data.anticipos - data.transporte - data.porcentaje_bs - data.diesel_topes;
  return {
    peso_neto: Math.round(pesoNeto * 100) / 100,
    tmns: Math.round(tmns * 100) / 100,
    precio_por_tn: Math.round(precioPorTn * 100) / 100,
    kl_finos: Math.round(klFinos * 100) / 100,
    lb_finas: Math.round(lbFinas * 100) / 100,
    val_min_usd: Math.round(valMinUsd * 100) / 100,
    val_min_bs: Math.round(valMinBs * 100) / 100,
    total_retenciones: Math.round(totalRetenciones * 100) / 100,
    sub_total_bs: Math.round(subTotalBs * 100) / 100,
    liquido_pagable_bs: Math.round(liquidoPagable * 100) / 100
  };
}

function listarPrecios() {
  const d = getDb();
  return d.prepare('SELECT * FROM mineral_precios ORDER BY mineral').all();
}

function actualizarPrecio(mineral, precio) {
  const d = getDb();
  d.prepare("UPDATE mineral_precios SET precio = ?, updated_at = datetime('now', '-4 hours') WHERE mineral = ?").run(precio, mineral);
  return listarPrecios();
}

function listarCompras() {
  const d = getDb();
  return d.prepare('SELECT * FROM mineral_compras ORDER BY created_at DESC').all();
}

function obtenerCompra(id) {
  const d = getDb();
  return d.prepare('SELECT * FROM mineral_compras WHERE id = ?').get(id);
}

function crearCompra(data) {
  const d = getDb();
  const calc = calcular(data);
  const stmt = d.prepare(`
    INSERT INTO mineral_compras (
      nro_lote, fecha_entrega, fecha_liquidacion, nombre_productor, cooperativa,
      tipo_cambio, tc_oficial,
      peso_bruto, tara, peso_neto, h2o,
      ley_pb, ley_ag, ley_zn, precio_pb, precio_ag, precio_zn,
      precio_por_tn, ley_porcentaje, tmns, kl_finos, lb_finas,
      val_min_usd, val_min_bs,
      caja, comibol, fedecomin, wisterman, fencomin, regalia_zn_ag,
      anticipos, transporte, porcentaje_bs, diesel_topes,
      total_retenciones, sub_total_bs, liquido_pagable_bs
    ) VALUES (
      @nro_lote, @fecha_entrega, @fecha_liquidacion, @nombre_productor, @cooperativa,
      @tipo_cambio, @tc_oficial,
      @peso_bruto, @tara, @peso_neto, @h2o,
      @ley_pb, @ley_ag, @ley_zn, @precio_pb, @precio_ag, @precio_zn,
      @precio_por_tn, @ley_porcentaje, @tmns, @kl_finos, @lb_finas,
      @val_min_usd, @val_min_bs,
      @caja, @comibol, @fedecomin, @wisterman, @fencomin, @regalia_zn_ag,
      @anticipos, @transporte, @porcentaje_bs, @diesel_topes,
      @total_retenciones, @sub_total_bs, @liquido_pagable_bs
    )
  `);
  const params = {
    nro_lote: data.nro_lote,
    fecha_entrega: data.fecha_entrega,
    fecha_liquidacion: data.fecha_liquidacion,
    nombre_productor: data.nombre_productor,
    cooperativa: data.cooperativa || '',
    tipo_cambio: data.tipo_cambio,
    tc_oficial: data.tc_oficial,
    peso_bruto: data.peso_bruto,
    tara: data.tara,
    peso_neto: calc.peso_neto,
    h2o: data.h2o,
    ley_pb: data.ley_pb,
    ley_ag: data.ley_ag,
    ley_zn: data.ley_zn,
    precio_pb: data.precio_pb,
    precio_ag: data.precio_ag,
    precio_zn: data.precio_zn,
    precio_por_tn: calc.precio_por_tn,
    ley_porcentaje: data.ley_porcentaje,
    tmns: calc.tmns,
    kl_finos: calc.kl_finos,
    lb_finas: calc.lb_finas,
    val_min_usd: calc.val_min_usd,
    val_min_bs: calc.val_min_bs,
    caja: data.caja,
    comibol: data.comibol,
    fedecomin: data.fedecomin,
    wisterman: data.wisterman,
    fencomin: data.fencomin,
    regalia_zn_ag: data.regalia_zn_ag,
    anticipos: data.anticipos,
    transporte: data.transporte,
    porcentaje_bs: data.porcentaje_bs,
    diesel_topes: data.diesel_topes,
    total_retenciones: calc.total_retenciones,
    sub_total_bs: calc.sub_total_bs,
    liquido_pagable_bs: calc.liquido_pagable_bs
  };
  const result = stmt.run(params);
  return { id: result.lastInsertRowid, ...params, ...calc };
}

function eliminarCompra(id) {
  const d = getDb();
  d.prepare('DELETE FROM mineral_compras WHERE id = ?').run(id);
}

module.exports = { listarPrecios, actualizarPrecio, listarCompras, obtenerCompra, crearCompra, eliminarCompra, calcular };
