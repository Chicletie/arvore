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

// Temático da Academia Whitmore (universo Lótus) — azul royal + prata, cópia fixa dada pelo
// autor, igual pra convite novo ou reenvio de acesso. Serif segura (Georgia) em vez das fontes
// do site, já que a maioria dos clientes de email não carrega Google Fonts.
function buildInviteHtml(link) {
  return (
    '<div style="background:#0d1b3f;padding:32px 16px;font-family:Georgia,\'Times New Roman\',serif;color:#dfe4ea;">' +
      '<div style="max-width:480px;margin:0 auto;background:#13234f;border:1px solid #7c8aa8;border-radius:6px;padding:32px;">' +
        '<div style="font-size:24px;font-weight:600;margin-bottom:4px;color:#c7d0de;letter-spacing:0.03em;">Chamado dos Céus</div>' +
        '<div style="height:1px;background:#7c8aa8;margin:12px 0 20px;"></div>' +
        '<p style="font-size:16px;line-height:1.7;margin:0 0 16px;">A Academia Whitmore o convoca para prestigiar o acervo mais cobiçado do mundo mágico.</p>' +
        '<p style="font-size:16px;line-height:1.7;margin:0 0 16px;">Conclua seu registro abaixo para acessar todo o conhecimento que Ela pode nos fornecer.</p>' +
        '<div style="text-align:center;margin:28px 0;">' +
          '<a href="' + link + '" style="display:inline-block;background:#c7d0de;color:#0d1b3f;text-decoration:none;padding:12px 28px;border-radius:4px;font-size:15px;font-weight:600;">Escolher senha e entrar</a>' +
        '</div>' +
        '<p style="font-size:14px;font-style:italic;color:#a8b3c7;text-align:center;margin:0 0 20px;">Sub lege Coeli, scientia crescat</p>' +
        '<p style="font-size:13px;color:#8b96ac;line-height:1.5;margin:0;">Se você não esperava este email, pode ignorá-lo com segurança.</p>' +
      '</div>' +
    '</div>'
  );
}
