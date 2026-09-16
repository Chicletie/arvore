const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

// Único uso desta função: criar a conta de um jogador convidado usando o Admin SDK, que ignora
// a trava "Enable create (sign-up)" do Firebase Auth (desligada de propósito, ver project-infra),
// e mandar um email de convite com a cara do site (em vez do genérico "redefinir senha" do
// Firebase, que continua existindo só pra quando um jogador que já tem conta esquecer a senha
// de verdade). Confere pelo uid do chamador, não pelo email — uid nunca muda mesmo que o dono
// troque de email.
const OWNER_UID = "zda1tHqjyMNTdg2Kf5Wr7m8brt92";
const brevoApiKey = defineSecret("BREVO_API_KEY");

exports.createPlayerAccount = onCall({ secrets: [brevoApiKey] }, async (request) => {
  if (!request.auth || request.auth.uid !== OWNER_UID) {
    throw new HttpsError("permission-denied", "Só o dono do mundo pode convidar jogadores.");
  }
  const email = ((request.data && request.data.email) || "").trim();
  if (!email) {
    throw new HttpsError("invalid-argument", "Email é obrigatório.");
  }

  var isNew = true;
  try {
    await admin.auth().createUser({ email: email, emailVerified: false });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      // Já tem conta — não é erro do fluxo de convite, só manda um link de acesso novo.
      isNew = false;
    } else {
      throw new HttpsError("internal", err.message || "Não consegui criar a conta.");
    }
  }

  var link;
  try {
    link = await admin.auth().generatePasswordResetLink(email);
  } catch (err) {
    throw new HttpsError("internal", "Conta criada, mas não consegui gerar o link de acesso: " + (err.message || err));
  }

  try {
    await sendInviteEmail(email, link, isNew, brevoApiKey.value());
  } catch (err) {
    throw new HttpsError("internal", "Conta pronta, mas não consegui mandar o email: " + (err.message || err));
  }

  return { created: isNew };
});

async function sendInviteEmail(email, link, isNew, apiKey) {
  var res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      sender: { name: "Paradise Gate", email: "convites@paradisegate.com.br" },
      to: [{ email: email }],
      subject: "Chamado dos Céus",
      htmlContent: buildInviteHtml(link)
    })
  });
  if (!res.ok) {
    var text = await res.text().catch(function () { return ""; });
    throw new Error("Brevo respondeu " + res.status + ": " + text);
  }
}

// Temático da Academia Whitmore (universo Lótus) — envelope azul-royal por fora, carta de
// pergaminho por dentro (paleta cream/tinta do próprio site), selo de cera PRATEADO no topo e
// uma capitular de verdade na abertura. Documento HTML completo (não só um <div>) porque a fonte
// do Google carrega em ALGUNS clientes que respeitam <link> no <head> (ex: Apple Mail) — mas o
// Gmail, o mais comum, descarta o <head> inteiro, então a Pinyon Script nunca chega lá. Por isso
// o fallback do "W" não pode ser um serifado qualquer: é itálico + negrito de propósito, pra
// parecer uma escolha estética mesmo quando a fonte custom não carrega (o que é o caso mais
// comum, não a exceção). Três lições confirmadas em cliente real, todas resolvidas com técnica de
// tabela (o padrão robusto de HTML email, ao contrário de `float`/`margin:auto` num <div>, que
// não são confiáveis): (1) a capitular é uma célula de tabela, não um span flutuante. (2) o selo
// agora é centralizado por uma <table align="center"> em vez de `margin:0 auto` num <div> — Gmail
// ignora esse auto-centering em bloco. (3) o segundo parágrafo virou uma segunda linha da MESMA
// tabela da capitular, pra alinhar com o texto da primeira linha (antes ficava desalinhado, sem
// o recuo da capitular).
function buildInviteHtml(link) {
  return (
    '<!doctype html><html><head><meta charset="utf-8" />' +
    '<link rel="preconnect" href="https://fonts.googleapis.com" />' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Pinyon+Script&display=swap" />' +
    '</head><body style="margin:0;">' +
    '<div style="background:#0a1730;padding:44px 16px;font-family:Georgia,\'Times New Roman\',serif;">' +
      '<div style="max-width:460px;margin:0 auto;">' +
        '<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 -36px;position:relative;z-index:2;">' +
          '<tr><td align="center">' +
            '<div style="width:72px;height:72px;border-radius:50%;display:inline-block;' +
              'background:radial-gradient(circle at 33% 28%,#f5f7f9 0%,#d7dde4 32%,#a7b1bf 68%,#7f8a9a 100%);' +
              'border:3px solid #eef1f4;box-shadow:0 5px 12px rgba(0,0,0,0.5),inset 0 1px 3px rgba(255,255,255,0.7);' +
              'text-align:center;line-height:66px;font-family:\'Pinyon Script\',Georgia,\'Times New Roman\',cursive,serif;font-style:italic;font-weight:700;font-size:36px;color:#1a2440;">W</div>' +
          '</td></tr>' +
        '</table>' +
        '<div style="background:#f5ecd6;border:1px solid #d2bf98;border-radius:4px;padding:48px 32px 34px;color:#2e2416;">' +
          '<div style="font-family:\'Cinzel\',Georgia,serif;font-size:22px;font-weight:700;text-align:center;letter-spacing:0.07em;color:#0d1b3f;margin-bottom:20px;">CHAMADO DOS C&Eacute;US</div>' +
          '<div style="height:1px;background:#c9b98a;margin:0 0 22px;"></div>' +
          '<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 16px;">' +
            '<tr>' +
              '<td width="42" valign="top" style="font-family:\'Cinzel\',Georgia,serif;font-size:52px;line-height:0.82;font-weight:700;color:#0d1b3f;padding:2px 8px 0 0;">A</td>' +
              '<td valign="top" style="font-size:16px;line-height:1.75;color:#2e2416;padding-top:5px;">Academia Whitmore o convoca para prestigiar o acervo mais cobiçado do mundo mágico.</td>' +
            '</tr>' +
            '<tr>' +
              '<td></td>' +
              '<td style="font-size:16px;line-height:1.75;color:#2e2416;padding-top:14px;">Conclua seu registro abaixo para acessar todo o conhecimento que Ela pode nos fornecer.</td>' +
            '</tr>' +
          '</table>' +
          '<div style="text-align:center;margin:30px 0 26px;">' +
            '<a href="' + link + '" style="display:inline-block;background:#0d1b3f;color:#dfe4ea;text-decoration:none;padding:13px 30px;border-radius:2px;font-size:14px;font-weight:700;letter-spacing:0.05em;">ESCOLHER SENHA E ENTRAR</a>' +
          '</div>' +
          '<p style="font-size:15px;font-style:italic;color:#6a5940;text-align:center;margin:0;">Sub lege Coeli, scientia crescat</p>' +
        '</div>' +
        '<p style="font-size:12px;color:#7c8aa8;line-height:1.5;margin:18px 6px 0;text-align:center;">Se você não esperava este email, pode ignorá-lo com segurança.</p>' +
      '</div>' +
    '</div>' +
    '</body></html>'
  );
}
