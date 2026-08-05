const config = require('../config/env');

async function lookupPerson(numero) {
  if (!numero) {
    throw Object.assign(new Error('Debe enviar un numero de telefono o codigo de usuario.'), { status: 400 });
  }
  if (!config.erp.token) {
    throw Object.assign(new Error('Falta configurar ERP_TOKEN en el servidor.'), { status: 500 });
  }

  if (config.erp.tlsRejectUnauthorized) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  let response;
  try {
    response = await fetch(`${config.erp.apiUrl}/${encodeURIComponent(numero)}`, {
      headers: {
        Authorization: `Bearer ${config.erp.token}`,
        Accept: 'application/json'
      }
    });
  } catch (error) {
    throw Object.assign(new Error(`No se pudo conectar con el ERP: ${error.message}`), { status: 502 });
  }

  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    throw Object.assign(new Error(data?.message || 'Error al consultar el ERP.'), { status: response.status });
  }

  return data;
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

module.exports = { lookupPerson };
