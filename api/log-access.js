export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Método não permitido"
    });
  }

  try {

    const body = req.body || {};

    const ipReal =
      req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      "";

    const registro = {
      dataServidor: new Date().toISOString(),

      evento: body.evento || "",
      sessionId: body.sessionId || "",

      ipVercel: ipReal,

      url: body.url || "",
      path: body.path || "",
      host: body.host || "",
      titulo: body.titulo || "",
      referrer: body.referrer || "",

      permanenciaMs: body.permanenciaMs || 0,

      geoip: {
        cidade: body.geoip?.cidade || "",
        estado: body.geoip?.estado || "",
        pais: body.geoip?.pais || "",
        latitudeAprox: body.geoip?.latitudeAprox || null,
        longitudeAprox: body.geoip?.longitudeAprox || null,
        ipPublicoCliente: body.geoip?.ip_publico_cliente || "",
        org: body.geoip?.org || ""
      },

      geolocalizacaoExata: {
        latitude: body.geolocalizacaoExata?.latitude || null,
        longitude: body.geolocalizacaoExata?.longitude || null,
        precisao: body.geolocalizacaoExata?.precisao || null
      },

      navegador: body.navegador || {},

      utm: body.utm || {},

      dataCliente: body.dataClienteIso || ""
    };

    console.log("LOG_ACESSO_SITE", JSON.stringify(registro));

    return res.status(200).json({
      ok: true
    });

  } catch (error) {

    console.error("ERRO_LOG_ACESSO", error);

    return res.status(500).json({
      ok: false,
      error: "Erro interno"
    });
  }
}