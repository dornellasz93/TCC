/**
 * Gerenciador de Certificados TLS/HTTPS Locais (Auto-Provisionado)
 * Gera uma Autoridade Certificadora (CA) local persistente em /app/data/ssl e assina um
 * certificado folha (validade de 365 dias <= 398 dias exigidos pelo iOS/Safari/WebKit,
 * basicConstraints=CA:FALSE, extendedKeyUsage=serverAuth e Subject Alternative Names dinâmicos)
 * para habilitar GPS Real (HTML5 Geolocation) e Câmera (getUserMedia) via HTTPS na rede local.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const tls = require('tls');
const { execFileSync } = require('child_process');

function isIpv4(host) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
}

function isValidHostname(host) {
  return /^[a-zA-Z0-9.-]+$/.test(host) && !host.includes('..');
}

function collectDetectedIps() {
  const ips = new Set(['127.0.0.1']);
  const envIps = (process.env.SSL_IPS || process.env.HOST_IP || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const ip of envIps) {
    if (isIpv4(ip)) ips.add(ip);
  }

  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const iface of list || []) {
      if (iface.family === 'IPv4' && iface.address) {
        ips.add(iface.address);
      }
    }
  }
  return Array.from(ips);
}

function createSslManager(dataDir) {
  const sslDir = path.join(dataDir, 'ssl');
  const caKeyPath = path.join(sslDir, 'ca-key.pem');
  const caCertPath = path.join(sslDir, 'ca.crt');
  const serverKeyPath = path.join(sslDir, 'server-key.pem');
  const serverCertPath = path.join(sslDir, 'server-cert.pem');
  const sanMetaPath = path.join(sslDir, 'san-hosts.json');

  const knownIps = new Set(collectDetectedIps());
  const knownDns = new Set(['localhost']);

  // Carrega hosts já registrados anteriormente no volume persistente
  try {
    if (fs.existsSync(sanMetaPath)) {
      const saved = JSON.parse(fs.readFileSync(sanMetaPath, 'utf8'));
      (saved.ips || []).forEach((ip) => { if (isIpv4(ip)) knownIps.add(ip); });
      (saved.dns || []).forEach((d) => { if (isValidHostname(d)) knownDns.add(d); });
    }
  } catch {
    // Ignora metadados corrompidos e recria
  }

  function ensureCa() {
    fs.mkdirSync(sslDir, { recursive: true });
    if (fs.existsSync(caKeyPath) && fs.existsSync(caCertPath)) {
      return;
    }

    const caConf = path.join(sslDir, 'ca-openssl.cnf');
    fs.writeFileSync(caConf, [
      '[req]',
      'distinguished_name = dn',
      'x509_extensions = v3_ca',
      'prompt = no',
      '[dn]',
      'C = BR',
      'ST = RJ',
      'L = Volta Redonda',
      'O = UGB Presenca TCC',
      'CN = UGB Presenca Local Root CA',
      '[v3_ca]',
      'subjectKeyIdentifier = hash',
      'authorityKeyIdentifier = keyid:always,issuer',
      'basicConstraints = critical, CA:true, pathlen:0',
      'keyUsage = critical, digitalSignature, cRLSign, keyCertSign'
    ].join('\n'));

    execFileSync('openssl', [
      'req', '-x509', '-new', '-nodes',
      '-newkey', 'rsa:2048',
      '-sha256',
      '-days', '3650',
      '-keyout', caKeyPath,
      '-out', caCertPath,
      '-config', caConf
    ], { stdio: 'ignore' });
  }

  function signServerCert() {
    ensureCa();

    if (!fs.existsSync(serverKeyPath)) {
      execFileSync('openssl', ['genrsa', '-out', serverKeyPath, '2048'], { stdio: 'ignore' });
    }

    const csrPath = path.join(sslDir, 'server.csr');
    const extPath = path.join(sslDir, 'server-ext.cnf');
    const csrConf = path.join(sslDir, 'server-csr.cnf');

    const altEntries = [
      ...Array.from(knownDns).map((d, i) => `DNS.${i + 1} = ${d}`),
      ...Array.from(knownIps).map((ip, i) => `IP.${i + 1} = ${ip}`)
    ];

    fs.writeFileSync(csrConf, [
      '[req]',
      'distinguished_name = dn',
      'prompt = no',
      '[dn]',
      'C = BR',
      'ST = RJ',
      'L = Volta Redonda',
      'O = UGB Presenca TCC',
      'CN = UGB Presenca HTTPS'
    ].join('\n'));

    fs.writeFileSync(extPath, [
      'authorityKeyIdentifier = keyid,issuer',
      'basicConstraints = critical, CA:FALSE',
      'keyUsage = critical, digitalSignature, keyEncipherment',
      'extendedKeyUsage = serverAuth',
      'subjectAltName = @alt_names',
      '[alt_names]',
      ...altEntries
    ].join('\n'));

    execFileSync('openssl', [
      'req', '-new',
      '-key', serverKeyPath,
      '-out', csrPath,
      '-config', csrConf
    ], { stdio: 'ignore' });

    // Validade de 365 dias (<= 398 dias exigidos pelo Apple iOS/macOS WebKit)
    execFileSync('openssl', [
      'x509', '-req',
      '-in', csrPath,
      '-CA', caCertPath,
      '-CAkey', caKeyPath,
      '-CAcreateserial',
      '-out', serverCertPath,
      '-days', '365',
      '-sha256',
      '-extfile', extPath
    ], { stdio: 'ignore' });

    fs.writeFileSync(sanMetaPath, JSON.stringify({
      ips: Array.from(knownIps),
      dns: Array.from(knownDns),
      updatedAt: new Date().toISOString()
    }, null, 2));
  }

  function readCredentials() {
    const key = fs.readFileSync(serverKeyPath);
    const cert = Buffer.concat([
      fs.readFileSync(serverCertPath),
      Buffer.from('\n'),
      fs.readFileSync(caCertPath)
    ]);
    return { key, cert };
  }

  let available = false;
  try {
    ensureCa();
    if (!fs.existsSync(serverKeyPath) || !fs.existsSync(serverCertPath) || !fs.existsSync(sanMetaPath)) {
      signServerCert();
    }
    available = true;
  } catch (err) {
    console.warn('[SSL] OpenSSL indisponível ou falha ao gerar certificados locais:', err.message);
  }

  return {
    available,
    caCertPath,
    getCredentials() {
      if (!available) return null;
      return readCredentials();
    },
    ensureHost(rawHost, httpsServer) {
      if (!available || !rawHost || typeof rawHost !== 'string') return false;
      const host = rawHost.trim().replace(/^\[|\]$/g, '').split(':')[0].toLowerCase();
      if (!host) return false;

      let added = false;
      if (isIpv4(host) && !knownIps.has(host)) {
        knownIps.add(host);
        added = true;
      } else if (!isIpv4(host) && isValidHostname(host) && !knownDns.has(host)) {
        knownDns.add(host);
        added = true;
      }

      if (added) {
        try {
          signServerCert();
          if (httpsServer && typeof httpsServer.setSecureContext === 'function') {
            httpsServer.setSecureContext(readCredentials());
          }
          console.log(`[SSL] Certificado HTTPS atualizado automaticamente para incluir SAN: ${host}`);
          return true;
        } catch (err) {
          console.warn(`[SSL] Falha ao atualizar SAN para ${host}:`, err.message);
        }
      }
      return false;
    },
    createSecureContext() {
      if (!available) return null;
      return tls.createSecureContext(readCredentials());
    }
  };
}

module.exports = { createSslManager };
