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

  // Sem o segundo argumento, o Admin SDK gera um link que aponta pra página de ação genérica
  // hospedada pelo próprio Firebase (rotina-555dd.firebaseapp.com/__/auth/action) — a mesma
  // action URL customizada já usada no fluxo client-side de "esqueci minha senha"
  // (openLoginModal em wiki-core.js) precisa ser passada aqui também, senão só metade dos
  // dois jeitos de chegar num link de senha (esqueci-senha vs. convite) fica com a cara do site.
  var actionCodeSettings = { url: "https://paradisegate.com.br/reset-senha.html", handleCodeInApp: true };
  var link;
  try {
    link = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
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
// Gmail, o mais comum, descarta o <head> inteiro. O selo em si (círculo prateado + monograma em
// Pinyon Script + a moldura que ele "carimba" por cima) virou uma imagem PNG pré-renderizada
// (selo-whitmore.png, hospedada no próprio site) em vez de depender da fonte carregar no cliente —
// assim a tipografia cursiva é garantida em qualquer lugar, não só onde o Google Fonts sobrevive.
// A imagem já inclui a aba creme com cantos arredondados e a borda esquerda/superior/direita da
// carta embutidas nos próprios pixels (com o selo desenhado por cima dessa borda, ocultando o
// trecho onde ela cruzaria o selo) — por isso o <div> da carta abaixo não tem borda nem raio no
// topo: ele só continua visualmente de onde a imagem parou. Três lições confirmadas em cliente
// real, todas resolvidas com técnica de tabela (o padrão robusto de HTML email, ao contrário de
// `float`/`margin:auto`/margem negativa, que não são confiáveis): (1) a capitular é uma célula de
// tabela, não um span flutuante. (2) a sobreposição do selo na carta não pode depender de margem
// negativa (Gmail ignora/descarta), por isso agora está pré-composta na imagem. (3) o segundo
// parágrafo é uma segunda linha da MESMA tabela da capitular, pra alinhar com o texto da primeira.
function buildInviteHtml(link) {
  return (
    '<!doctype html><html><head><meta charset="utf-8" />' +
    '<link rel="preconnect" href="https://fonts.googleapis.com" />' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap" />' +
    '</head><body style="margin:0;">' +
    '<div style="background:#0a1730;padding:44px 16px;font-family:Georgia,\'Times New Roman\',serif;">' +
      '<div style="max-width:460px;margin:0 auto;">' +
        '<img src="https://paradisegate.com.br/selo-whitmore.png" width="460" height="170" alt="Selo da Academia Whitmore" style="display:block;width:100%;max-width:460px;height:auto;border:0;margin:0;" />' +
        '<div style="background:#f5ecd6;border:1px solid #d2bf98;border-top:none;border-radius:0 0 4px 4px;padding:22px 32px 34px;color:#2e2416;">' +
          '<div style="font-family:\'Cinzel\',Georgia,serif;font-size:22px;font-weight:700;text-align:center;letter-spacing:0.07em;color:#0d1b3f;margin-bottom:20px;">CHAMADO DOS C&Eacute;US</div>' +
          '<div style="height:1px;background:#c9b98a;margin:0 0 22px;"></div>' +
          '<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 16px;">' +
            '<tr>' +
              '<td width="42" valign="top" style="font-family:\'Cinzel\',Georgia,serif;font-size:52px;line-height:0.82;font-weight:700;color:#0d1b3f;padding:2px 8px 0 0;">A</td>' +
              '<td valign="top" style="font-size:16px;line-height:1.75;color:#2e2416;padding-top:5px;">Academia Whitmore o convoca para prestigiar o acervo mais cobiçado do mundo mágico.</td>' +
            '</tr>' +
            '<tr>' +
              '<td></td>' +
              '<td style="font-size:16px;line-height:1.75;color:#2e2416;padding-top:14px;">Conclua seu registro abaixo para acessar todo o conhecimento que Ela pode nos oferecer.</td>' +
            '</tr>' +
          '</table>' +
          '<div style="text-align:center;margin:30px 0 26px;">' +
            '<a href="' + link + '" style="display:inline-block;background:#0d1b3f;color:#dfe4ea;text-decoration:none;padding:13px 30px;border-radius:2px;font-size:14px;font-weight:700;letter-spacing:0.05em;">ESCOLHER SENHA E ENTRAR</a>' +
          '</div>' +
          '<p style="font-size:15px;font-style:italic;color:#2e2416;text-align:right;margin:0 4px 2px;">Com honra,</p>' +
          '<p style="font-family:\'Cinzel\',Georgia,serif;font-size:15px;font-weight:700;color:#0d1b3f;text-align:right;letter-spacing:0.03em;margin:0 4px 26px;">S&aacute;bio Oliver Montgomery</p>' +
          '<p style="font-size:15px;font-style:italic;color:#6a5940;text-align:center;margin:0;">Sub lege Coeli, scientia crescat</p>' +
        '</div>' +
        '<p style="font-size:12px;color:#7c8aa8;line-height:1.5;margin:18px 6px 0;text-align:center;">Se você não esperava este email, pode ignorá-lo com segurança.</p>' +
      '</div>' +
    '</div>' +
    '</body></html>'
  );
}
