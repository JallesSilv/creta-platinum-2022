export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  try {
    const body = req.body || {};

    const registro = {
      dataServidor: new Date().toISOString(),
      ipVercel:
        req.headers["x-forwarded-for"] ||
        req.socket?.remoteAddress ||
        "",
      cidade: body.cidade || "",
      estado: body.estado || "",
      pais: body.pais || "",
      ipPublicoCliente: body.ip_publico_cliente || "",
      navegador: body.navegador || "",
      idioma: body.idioma || "",
      resolucao: body.resolucao || "",
      url: body.url || "",
      referrer: body.referrer || "",
      dataCliente: body.data_cliente || ""
    };

    console.log("LOG_ACESSO_SITE", JSON.stringify(registro));

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("ERRO_LOG_ACESSO", error);
    return res.status(500).json({ ok: false, error: "Erro interno" });
  }
}