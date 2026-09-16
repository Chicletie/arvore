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
// autor, igual pra convite novo ou reenvio de acesso. Documento HTML completo (não só um <div>)
// porque as fontes do Google só carregam em clientes de email que respeitam <link> no <head>
// (Apple Mail, a maioria dos apps móveis, alguns desktop) — nos que não respeitam (Outlook
// desktop, certos contextos do Gmail), cai de volta pra serifa segura do fallback, sem quebrar
// nada. Cinzel (gravada em pedra) só no título; um cursivo só no lema em latim — nomes curtos o
// bastante pra não arriscar legibilidade caso o fallback entre em ação. Capitular na primeira
// frase e o floreio "❧" (mesmo símbolo já usado no site) são efeito puro de CSS/texto, sem
// depender de fonte nem imagem — funcionam em qualquer cliente.
function buildInviteHtml(link) {
  return (
    '<!doctype html><html><head><meta charset="utf-8" />' +
    '<link rel="preconnect" href="https://fonts.googleapis.com" />' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Tangerine:wght@700&display=swap" />' +
    '</head><body style="margin:0;">' +
    '<div style="background:#0a1730;padding:36px 16px;font-family:Georgia,\'Times New Roman\',serif;color:#dfe4ea;">' +
      '<div style="max-width:480px;margin:0 auto;background:#13234f;border:2px solid #5c6d94;padding:2px;">' +
        '<div style="border:1px solid #3a4a70;padding:36px 32px;">' +
          '<div style="text-align:center;font-size:20px;color:#7c8aa8;margin-bottom:10px;">&#10087;</div>' +
          '<div style="font-family:\'Cinzel\',Georgia,serif;font-size:25px;font-weight:700;text-align:center;letter-spacing:0.08em;color:#c7d0de;margin-bottom:20px;">CHAMADO DOS C&Eacute;US</div>' +
          '<div style="height:1px;background:#3a4a70;margin:0 0 26px;"></div>' +
          '<p style="font-size:16px;line-height:1.8;margin:0 0 16px;">' +
            '<span style="font-family:Georgia,serif;font-size:46px;line-height:0.6;float:left;padding:8px 9px 0 0;color:#c7d0de;">A</span>' +
            'cademia Whitmore o convoca para prestigiar o acervo mais cobiçado do mundo mágico.' +
          '</p>' +
          '<p style="font-size:16px;line-height:1.8;margin:16px 0 0;clear:both;">Conclua seu registro abaixo para acessar todo o conhecimento que Ela pode nos fornecer.</p>' +
          '<div style="text-align:center;margin:32px 0;">' +
            '<a href="' + link + '" style="display:inline-block;background:#c7d0de;color:#0d1b3f;text-decoration:none;padding:13px 30px;border-radius:2px;font-size:14px;font-weight:700;letter-spacing:0.05em;">ESCOLHER SENHA E ENTRAR</a>' +
          '</div>' +
          '<p style="font-family:\'Tangerine\',\'Brush Script MT\',cursive;font-size:34px;color:#a8b3c7;text-align:center;margin:4px 0 24px;">Sub lege Coeli, scientia crescat</p>' +
          '<div style="text-align:center;font-size:16px;color:#3a4a70;margin-bottom:18px;">&#10087;</div>' +
          '<p style="font-size:12px;color:#63708c;line-height:1.5;margin:0;text-align:center;">Se você não esperava este email, pode ignorá-lo com segurança.</p>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '</body></html>'
  );
}
