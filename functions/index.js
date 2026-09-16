const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

// Único uso desta função: criar a conta de um jogador convidado usando o Admin SDK, que ignora
// a trava "Enable create (sign-up)" do Firebase Auth (desligada de propósito, ver project-infra).
// Confere pelo uid do chamador, não pelo email — uid nunca muda mesmo que o dono troque de email.
const OWNER_UID = "zda1tHqjyMNTdg2Kf5Wr7m8brt92";

exports.createPlayerAccount = onCall(async (request) => {
  if (!request.auth || request.auth.uid !== OWNER_UID) {
    throw new HttpsError("permission-denied", "Só o dono do mundo pode convidar jogadores.");
  }
  const email = ((request.data && request.data.email) || "").trim();
  if (!email) {
    throw new HttpsError("invalid-argument", "Email é obrigatório.");
  }
  try {
    await admin.auth().createUser({ email: email, emailVerified: false });
    return { created: true };
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      // Já tem conta — não é erro do fluxo de convite, o cliente manda o email de redefinir
      // senha do mesmo jeito, pra pessoa entrar de novo.
      return { created: false, alreadyExists: true };
    }
    throw new HttpsError("internal", err.message || "Não consegui criar a conta.");
  }
});
