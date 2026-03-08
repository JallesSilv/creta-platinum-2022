export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Método não permitido"
    });
  }

  try {
    const body = req.body || {};

    const rawIp =
      req.headers["x-vercel-forwarded-for"] ||
      req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      "";

    const ipReal = Array.isArray(rawIp)
      ? rawIp[0]
      : String(rawIp).split(",")[0].trim();

    function ipValido(ip) {
      if (!ip) return false;

      const invalidos = ["::1", "127.0.0.1", "localhost", "unknown"];
      if (invalidos.includes(String(ip).toLowerCase())) return false;

      return true;
    }

    async function fetchComTimeout(url, ms = 5000) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ms);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "creta-platinum-vercel-logger/1.0"
          }
        });
        return response;
      } finally {
        clearTimeout(timeout);
      }
    }

    async function buscarGeoPorIp(ip) {
      if (!ipValido(ip)) {
        return {
          cidade: "",
          estado: "",
          pais: "",
          siglaPais: "",
          latitudeAprox: null,
          longitudeAprox: null,
          org: "",
          ipPublicoCliente: ip || "",
          fonteGeo: "ip_invalido"
        };
      }

      // 1) ipapi.co
      try {
        const resp = await fetchComTimeout(`https://ipapi.co/${ip}/json/`, 5000);
        const data = await resp.json();

        if (
          data &&
          !data.error &&
          (data.city || data.region || data.country_name || data.latitude || data.longitude)
        ) {
          return {
            cidade: data.city || "",
            estado: data.region || "",
            pais: data.country_name || "",
            siglaPais: data.country || "",
            latitudeAprox: data.latitude || null,
            longitudeAprox: data.longitude || null,
            org: data.org || "",
            ipPublicoCliente: data.ip || ip,
            fonteGeo: "ipapi"
          };
        }
      } catch (e) {
        console.error("FALHA_IPAPI", e?.message || e);
      }

      // 2) ipwho.is
      try {
        const resp = await fetchComTimeout(`https://ipwho.is/${ip}`, 5000);
        const data = await resp.json();

        if (data && data.success) {
          return {
            cidade: data.city || "",
            estado: data.region || "",
            pais: data.country || "",
            siglaPais: data.country_code || "",
            latitudeAprox: data.latitude || null,
            longitudeAprox: data.longitude || null,
            org: data.connection?.org || data.connection?.isp || "",
            ipPublicoCliente: data.ip || ip,
            fonteGeo: "ipwhois"
          };
        }
      } catch (e) {
        console.error("FALHA_IPWHOIS", e?.message || e);
      }

      return {
        cidade: "",
        estado: "",
        pais: "",
        siglaPais: "",
        latitudeAprox: null,
        longitudeAprox: null,
        org: "",
        ipPublicoCliente: ip || "",
        fonteGeo: "sem_retorno"
      };
    }

    const geoBackend = await buscarGeoPorIp(ipReal);

    const geoFinal = {
      cidade: body.geoip?.cidade || geoBackend.cidade || "",
      estado: body.geoip?.estado || geoBackend.estado || "",
      pais: body.geoip?.pais || geoBackend.pais || "",
      siglaPais: body.geoip?.siglaPais || geoBackend.siglaPais || "",
      latitudeAprox: body.geoip?.latitudeAprox || geoBackend.latitudeAprox || null,
      longitudeAprox: body.geoip?.longitudeAprox || geoBackend.longitudeAprox || null,
      org: body.geoip?.org || geoBackend.org || "",
      ipPublicoCliente:
        body.geoip?.ip_publico_cliente || geoBackend.ipPublicoCliente || ipReal || "",
      fonteGeo: geoBackend.fonteGeo || ""
    };

    const geolocalizacaoExata = {
      latitude: body.geolocalizacaoExata?.latitude || null,
      longitude: body.geolocalizacaoExata?.longitude || null,
      precisao: body.geolocalizacaoExata?.precisao || null
    };

    const navegador = body.navegador || {};
    const permanenciaMs = Number(body.permanenciaMs || 0);
    const userAgent = String(navegador.userAgent || "").toLowerCase();
    const tipoDispositivo = navegador.tipoDispositivo || "";

    const mapaAproximado =
      geoFinal.latitudeAprox && geoFinal.longitudeAprox
        ? `https://maps.google.com/?q=${geoFinal.latitudeAprox},${geoFinal.longitudeAprox}`
        : "";

    const mapaExato =
      geolocalizacaoExata.latitude && geolocalizacaoExata.longitude
        ? `https://maps.google.com/?q=${geolocalizacaoExata.latitude},${geolocalizacaoExata.longitude}`
        : "";

    let classificacao = "inconclusivo";

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
      ip: ipReal,
      cidade: registro.geoip.cidade,
      estado: registro.geoip.estado,
      pais: registro.geoip.pais,
      latitudeAprox: registro.geoip.latitudeAprox,
      longitudeAprox: registro.geoip.longitudeAprox,
      fonteGeo: registro.geoip.fonteGeo,
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