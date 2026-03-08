export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Método não permitido"
    });
  }

  try {
    const body = req.body || {};

    const ipHeader =
      req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      "";

    const ipReal = Array.isArray(ipHeader)
      ? ipHeader[0]
      : String(ipHeader).split(",")[0].trim();

    let geoBackend = {};

    try {
      const geoResp = await fetch(`https://ipapi.co/${ipReal}/json/`);
      const geoData = await geoResp.json();

      geoBackend = {
        cidade: geoData.city || "",
        estado: geoData.region || "",
        pais: geoData.country_name || "",
        siglaPais: geoData.country || "",
        latitudeAprox: geoData.latitude || null,
        longitudeAprox: geoData.longitude || null,
        org: geoData.org || "",
        ipPublicoCliente: geoData.ip || ipReal || ""
      };
    } catch (geoError) {
      geoBackend = {
        cidade: "",
        estado: "",
        pais: "",
        siglaPais: "",
        latitudeAprox: null,
        longitudeAprox: null,
        org: "",
        ipPublicoCliente: ipReal || ""
      };
    }

    const geoFinal = {
      cidade: body.geoip?.cidade || geoBackend.cidade || "",
      estado: body.geoip?.estado || geoBackend.estado || "",
      pais: body.geoip?.pais || geoBackend.pais || "",
      siglaPais: body.geoip?.siglaPais || geoBackend.siglaPais || "",
      latitudeAprox: body.geoip?.latitudeAprox || geoBackend.latitudeAprox || null,
      longitudeAprox: body.geoip?.longitudeAprox || geoBackend.longitudeAprox || null,
      org: body.geoip?.org || geoBackend.org || "",
      ipPublicoCliente: body.geoip?.ip_publico_cliente || geoBackend.ipPublicoCliente || ipReal || ""
    };

    const geolocalizacaoExata = {
      latitude: body.geolocalizacaoExata?.latitude || null,
      longitude: body.geolocalizacaoExata?.longitude || null,
      precisao: body.geolocalizacaoExata?.precisao || null
    };

    const navegador = body.navegador || {};

    const mapaAproximado =
      geoFinal.latitudeAprox && geoFinal.longitudeAprox
        ? `https://maps.google.com/?q=${geoFinal.latitudeAprox},${geoFinal.longitudeAprox}`
        : "";

    const mapaExato =
      geolocalizacaoExata.latitude && geolocalizacaoExata.longitude
        ? `https://maps.google.com/?q=${geolocalizacaoExata.latitude},${geolocalizacaoExata.longitude}`
        : "";

    let classificacao = "inconclusivo";

    const permanenciaMs = Number(body.permanenciaMs || 0);
    const userAgent = String(navegador.userAgent || "").toLowerCase();
    const tipoDispositivo = navegador.tipoDispositivo || "";

    if (
      userAgent.includes("bot") ||
      userAgent.includes("crawler") ||
      userAgent.includes("spider") ||
      userAgent.includes("headless")
    ) {
      classificacao = "provavel_bot";
    } else if (
      permanenciaMs >= 10000 ||
      body.evento === "clique_whatsapp" ||
      body.evento === "localizacao_exata_autorizada"
    ) {
      classificacao = "provavel_humano";
    } else if (
      permanenciaMs < 2000 &&
      (body.evento === "page_close" || body.evento === "visibility_hidden")
    ) {
      classificacao = "acesso_rapido";
    } else if (tipoDispositivo === "mobile" || tipoDispositivo === "desktop") {
      classificacao = "inconclusivo_com_perfil_real";
    }

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

      permanenciaMs,

      geoip: geoFinal,
      geolocalizacaoExata,
      mapaAproximado,
      mapaExato,

      navegador: {
        userAgent: navegador.userAgent || "",
        idioma: navegador.idioma || "",
        idiomas: navegador.idiomas || [],
        plataforma: navegador.plataforma || "",
        cookieHabilitado: navegador.cookieHabilitado ?? null,
        online: navegador.online ?? null,
        touchPoints: navegador.touchPoints ?? null,
        coresCpu: navegador.coresCpu ?? null,
        memoriaGB: navegador.memoriaGB ?? null,
        larguraTela: navegador.larguraTela ?? null,
        alturaTela: navegador.alturaTela ?? null,
        resolucao: navegador.resolucao || "",
        viewport: navegador.viewport || "",
        timezone: navegador.timezone || "",
        timezoneOffset: navegador.timezoneOffset ?? null,
        tipoDispositivo: navegador.tipoDispositivo || ""
      },

      utm: body.utm || {},
      dataCliente: body.dataClienteIso || "",
      classificacao
    };

    console.log("LOG_ACESSO_SITE", JSON.stringify(registro));

    return res.status(200).json({
      ok: true,
      classificacao,
      cidade: registro.geoip.cidade,
      estado: registro.geoip.estado,
      pais: registro.geoip.pais,
      latitudeAprox: registro.geoip.latitudeAprox,
      longitudeAprox: registro.geoip.longitudeAprox,
      mapaAproximado,
      mapaExato
    });
  } catch (error) {
    console.error("ERRO_LOG_ACESSO", error);

    return res.status(500).json({
      ok: false,
      error: "Erro interno"
    });
  }
}