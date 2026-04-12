/**
 * COUSINADE BOB 2026 - LOGIQUE FRONTEND
 * Structure organisée : 
 * 1. Config & Variables
 * 2. Cœur (Chargement & Stats)
 * 3. Livre d'Or (Affichage & Actions)
 * 4. Gestion des Plats (Affichage & Actions)
 * 5. Utilitaires & Modales
 */

// ==========================================
// 1. CONFIGURATION & VARIABLES GLOBALES
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycby6mZtTpmD5yi4aP3yx1rWbQ8H0jtEWTqaUghZpHU86IteUAaAWEDM4dJyImmPh6t6_/exec";
const DATE_COUSINADE = new Date("2026-05-09T12:00:00");

let plats = [];
let commentaires = []; 
let idEnEditionModale = null; // Pour les plats
let comIdEnEdition = null;    // Pour le livre d'or
let browserId = localStorage.getItem('cousinade_id') || ('user_' + Math.random().toString(36).substr(2, 9));
localStorage.setItem('cousinade_id', browserId);

// ==========================================
// 2. CŒUR DU SCRIPT (INITIALISATION)
// ==========================================

/**
 * Charge toutes les données depuis le Google Sheet au démarrage
 */
async function chargerDonnees() {
    try {
        const [resPlats, resComs] = await Promise.all([
            fetch(`${API_URL}?action=getPlats`),
            fetch(`${API_URL}?action=getCommentaires`)
        ]);
        plats = await resPlats.json();
        commentaires = await resComs.json();

        afficherPlats();
        afficherLivreDor(); 
        calculerStatsGlobales();
    } catch (e) {
        console.error("Erreur de chargement :", e);
    }
}

/**
 * Calcule le nombre total de convives et de parts
 */
function calculerStatsGlobales() {
    const vus = new Set();
    let totalConv = 0;
    plats.forEach(p => {
        if (!vus.has(p.ownerId)) {
            totalConv += parseFloat(p.convives || 0);
            vus.add(p.ownerId);
        }
    });
    document.getElementById('stat-convives').innerText = totalConv;
    document.getElementById('stat-total').innerText = plats.reduce((s, p) => s + parseInt(p.parts || 0), 0);
    verifierSiDejaInscrit();
}

// ==========================================
// 3. GESTION DU LIVRE D'OR
// ==========================================

/**
 * Affiche les messages du livre d'or sous forme de cartes
 */
function afficherLivreDor() {
    const container = document.getElementById('livreDor');
    if (!container) return;

    container.innerHTML = commentaires.map(m => {
        // Sécurité : on utilise le messageId unique, sinon la date par défaut
        const idUnique = m.messageId || m.date; 

        return `
        <div class="com-card" style="background:#fff9e6; padding:15px; border-radius:10px; border-left:5px solid #feca57; position:relative; margin-bottom:10px; box-shadow: 2px 2px 5px rgba(0,0,0,0.05);">
            ${m.ownerId === browserId ? `
                <div style="position:absolute; top:10px; right:10px; display:flex; gap:5px;">
                    <button onclick="ouvrirModifCom('${idUnique}', '${m.commentaire.replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer; font-size:1.2em;">✏️</button>
                    <button onclick="supprimerCommentaire('${idUnique}')" style="background:none; border:none; cursor:pointer; font-size:1.2em;">🗑️</button>
                </div>
            ` : ''}
            <p style="margin:0; font-style:italic; white-space:pre-wrap; color:#444;">"${m.commentaire}"</p>
            <p style="margin:10px 0 0 0; text-align:right; font-weight:bold; font-size:0.8em; color:#666;">
                — ${m.nom}
            </p>
        </div>
    `}).reverse().join('') || '<p style="text-align:center;color:gray;">Aucun message...</p>';
}

/**
 * Ajoute un nouveau message au livre d'or
 */
async function ajouterCommentaireDirect() {
    const nomVal = document.getElementById('nomPersonne').value.trim();
    const comVal = document.getElementById('commentaireSaisieSeule').value.trim();

    if (!nomVal) return alert("Saisissez votre prénom en haut pour signer !");
    if (!comVal) return alert("Le message est vide...");

    const btn = document.getElementById('btnCom');
    btn.disabled = true;
    btn.innerText = "Publication...";

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "insert",
                nom: nomVal,
                commentaire: comVal,
                plat: "Message Livre d'Or",
                browserId: browserId,
                convives: 0,
                parts: 0,
                categorie: "autre"
            })
        });
        document.getElementById('commentaireSaisieSeule').value = "";
        await chargerDonnees();
        alert("Message publié ! ✨");
    } catch (e) {
        alert("Erreur d'envoi");
    } finally {
        btn.disabled = false;
        btn.innerText = "Publier mon message";
    }
}

/**
 * Envoie la modification d'un message existant
 */
async function validerModifCom() {
    const nouveauMessage = document.getElementById('editCom').value.trim();
    fermerModaleLivreDor();

    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: "updateCommentaire",
            messageId: comIdEnEdition,
            commentaire: nouveauMessage,
            browserId: browserId
        })
    });
    await chargerDonnees();
}

/**
 * Supprime un message du livre d'or (envoi d'un texte vide)
 */
async function supprimerCommentaire(id) {
    if (!confirm("Voulez-vous supprimer ce message ?")) return;
    try {
        await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: "updateCommentaire", 
                messageId: id,
                commentaire: "", 
                browserId: browserId 
            })
        });
        await chargerDonnees();
    } catch (e) {
        alert("Erreur lors de la suppression");
    }
}

// ==========================================
// 4. GESTION DES PLATS
// ==========================================

/**
 * Affiche la liste des plats par catégorie et les allergies
 */
function afficherPlats() {
    const cats = [
        ['aperoListe', 'apero', '🍹'],
        ['entreeListe', 'entree', '🥗'],
        ['platListe', 'platPrincipal', '🥘'],
        ['dessertListe', 'dessert', '🍰'],
        ['autreListe', 'autre', '📦']
    ];

    cats.forEach(([elemId, key, icon]) => {
        const list = plats.filter(p => p.categorie === key && p.plat !== "Présence uniquement");
        const badge = document.getElementById('total-' + key);
        if (badge) badge.innerText = list.reduce((s, p) => s + parseInt(p.parts || 0), 0);

        document.getElementById(elemId).innerHTML = list.map(p => `
            <div class="plat-item">
                <span>${icon} <strong>${p.nom}</strong><br>${p.plat} (${p.parts}p)</span>
                ${p.ownerId === browserId ? `
                    <div style="display:flex; gap:5px;">
                        <button onclick="ouvrirModifPlat(${p.id})" class="btn-action">✏️</button>
                        <button onclick="supprimerPlat(${p.id})" class="btn-action">🗑️</button>
                    </div>` : ''}
            </div>
        `).join('') || '<div style="color:gray; font-size:0.8em; padding:5px;">Rien pour le moment</div>';
    });

    // Gestion de l'affichage des allergies (doublons filtrés par ownerId)
    const vus = new Set();
    const listeAllergies = plats.filter(p => {
        if (p.allergies && p.allergies.trim() !== "" && !vus.has(p.ownerId)) {
            vus.add(p.ownerId); return true;
        }
        return false;
    });
    document.getElementById('allergieListe').innerHTML = listeAllergies.map(p => `
        <div class="plat-item" style="border-left-color: #e74c3c;">
            <span>🚫 <strong>${p.nom}</strong><br>${p.allergies}</span>
        </div>
    `).join('') || '<div style="color:gray; font-size:0.8em; padding:5px;">Aucune allergie</div>';
}

/**
 * Envoie un nouveau plat au Google Sheet
 */
async function ajouterPlat() {
    const nomVal = document.getElementById('nomPersonne').value.trim();
    const convVal = document.getElementById('nbConvives').value;
    const platVal = document.getElementById('nouveauPlat').value.trim();
    const partsVal = document.getElementById('nombreParts').value || 0;
    const allergieVal = document.getElementById('allergieSaisie') ? document.getElementById('allergieSaisie').value.trim() : "";
    
    const radioCoche = document.querySelector('input[name="categoriePlat"]:checked');
    const catChoisie = radioCoche ? radioCoche.value : "autre";

    if (!nomVal) return alert("Le prénom est requis !");

    const btn = document.getElementById('btnAjouter');
    btn.disabled = true;
    btn.innerText = "Envoi...";

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "insert",
                nom: nomVal,
                convives: convVal || 0,
                plat: platVal || "Présence uniquement",
                parts: partsVal,
                categorie: catChoisie,
                allergies: allergieVal,
                browserId: browserId
            })
        });
        annulerEdition();
        await chargerDonnees();
    } catch (e) {
        alert("Erreur lors de l'envoi");
    } finally {
        btn.disabled = false;
        btn.innerText = "Valider mon plat";
    }
}

// ==========================================
// 5. UTILITAIRES & MODALES
// ==========================================

/**
 * Verrouille le nom si l'utilisateur est déjà inscrit
 */
function verifierSiDejaInscrit() {
    const monInscription = plats.find(p => p.ownerId === browserId);
    const box = document.getElementById('boxConvives');
    const msgOk = document.getElementById('msgConvivesOk');
    const inputNom = document.getElementById('nomPersonne');

    if (monInscription) {
        box.style.display = "none";
        msgOk.style.display = "block";
        inputNom.value = monInscription.nom;
        inputNom.readOnly = true;
        inputNom.style.background = "#f0f0f0";
    }
}

/**
 * Réinitialise le formulaire après ajout
 */
function annulerEdition() {
    document.getElementById('nouveauPlat').value = '';
    document.getElementById('nombreParts').value = '';
    document.getElementById('allergieSaisie').value = '';
    verifierSiDejaInscrit();
}

/**
 * Modales : Ouverture et Fermeture
 */
function ouvrirModifPlat(id) {
    const p = plats.find(x => x.id === id);
    if (!p) return;
    idEnEditionModale = id;
    document.getElementById('editPlatNom').value = p.plat;
    document.getElementById('editPlatParts').value = p.parts;
    document.getElementById('editPlatCat').value = p.categorie;
    document.getElementById('modalEdition').style.display = "block";
}

function fermerModale() { 
    document.getElementById('modalEdition').style.display = "none"; 
}

function ouvrirModifCom(id, ancienMessage) {
    comIdEnEdition = id;
    document.getElementById('editCom').value = ancienMessage;
    document.getElementById('modalLivreDor').style.display = "block";
}

function fermerModaleLivreDor() {
    const modale = document.getElementById('modalLivreDor');
    if (modale) modale.style.display = "none";
    comIdEnEdition = null;
}

// ==========================================
// Lancement & Compte à rebours
// ==========================================
chargerDonnees();

setInterval(() => {
    const diff = DATE_COUSINADE - new Date();
    const jours = Math.floor(diff / (1000 * 60 * 60 * 24));
    const countdownElem = document.getElementById("countdown");
    if (countdownElem) {
        countdownElem.innerText = diff > 0 ? `J-${jours} avant la cousinade !` : "C'est le jour J ! 🎉";
    }
}, 1000);/**
 * COUSINADE BOB 2026 - LOGIQUE FRONTEND
 */

const API_URL = "https://script.google.com/macros/s/AKfycby6mZtTpmD5yi4aP3yx1rWbQ8H0jtEWTqaUghZpHU86IteUAaAWEDM4dJyImmPh6t6_/exec";
const DATE_COUSINADE = new Date("2026-05-09T12:00:00");

let plats = [];
let commentaires = []; 
let idEnEditionModale = null;
let platEnEditionModale = null; 
let browserId = localStorage.getItem('cousinade_id') || ('user_' + Math.random().toString(36).substr(2, 9));
localStorage.setItem('cousinade_id', browserId);

// --- 1. CHARGEMENT ---

async function chargerDonnees() {
    try {
        const [resPlats, resComs] = await Promise.all([
            fetch(`${API_URL}?action=getPlats`),
            fetch(`${API_URL}?action=getCommentaires`)
        ]);
        plats = await resPlats.json();
        commentaires = await resComs.json();

        afficherPlats();
        afficherLivreDor(); 
        calculerStatsGlobales();
    } catch (e) {
        console.error("Erreur de chargement :", e);
    }
}

// --- 2. AFFICHAGE ---

/**
function afficherLivreDor() {
    const container = document.getElementById('livreDor');
    if (!container) return;

    container.innerHTML = commentaires.map(m => `
        <div class="com-card" style="background:#fff9e6; padding:15px; border-radius:10px; border-left:5px solid #feca57; position:relative; margin-bottom:10px;">
            ${m.ownerId === browserId ? `
                <div style="position:absolute; top:10px; right:10px; display:flex; gap:5px;">
                    <button onclick="ouvrirModifCom('${m.nom}', '${m.commentaire.replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer;">✏️</button>
                    <button onclick="supprimerCommentaire('${m.nom}')" style="background:none; border:none; cursor:pointer;">🗑️</button>
                </div>
            ` : ''}
            <p style="margin:0; font-style:italic; white-space:pre-wrap; color:#444;">"${m.commentaire}"</p>
            <p style="margin:10px 0 0 0; text-align:right; font-weight:bold; font-size:0.8em;">— ${m.nom}</p>
        </div>
    `).reverse().join('') || '<p style="text-align:center;color:gray;">Aucun message...</p>';
}
**/
// --- MODIF : Affichage pour gérer plusieurs messages ---
ffunction afficherLivreDor() {
    const container = document.getElementById('livreDor');
    if (!container) return;

    // On utilise map pour créer les cartes de messages
    container.innerHTML = commentaires.map(m => {
        // Sécurité : on vérifie si l'ID existe, sinon on utilise la date
        const idUnique = m.messageId || m.date; 

        return `
        <div class="com-card" style="background:#fff9e6; padding:15px; border-radius:10px; border-left:5px solid #feca57; position:relative; margin-bottom:10px; box-shadow: 2px 2px 5px rgba(0,0,0,0.05);">
            ${m.ownerId === browserId ? `
                <div style="position:absolute; top:10px; right:10px; display:flex; gap:5px;">
                    <button onclick="ouvrirModifCom('${idUnique}', '${m.commentaire.replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer; font-size:1.2em;">✏️</button>
                    <button onclick="supprimerCommentaire('${idUnique}')" style="background:none; border:none; cursor:pointer; font-size:1.2em;">🗑️</button>
                </div>
            ` : ''}
            <p style="margin:0; font-style:italic; white-space:pre-wrap; color:#444;">"${m.commentaire}"</p>
            <p style="margin:10px 0 0 0; text-align:right; font-weight:bold; font-size:0.8em; color:#666;">
                — ${m.nom}
            </p>
        </div>
    `}).reverse().join('') || '<p style="text-align:center;color:gray;">Aucun message...</p>';
}

// Mise à jour de la fonction de suppression pour utiliser l'ID
async function supprimerCommentaire(id) {
    if (!confirm("Voulez-vous supprimer ce message ?")) return;
    try {
        await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: "updateCommentaire", 
                messageId: id,
                commentaire: "", 
                browserId: browserId 
            })
        });
        await chargerDonnees();
    } catch (e) {
        alert("Erreur lors de la suppression");
    }
}
function afficherPlats() {
    const cats = [
        ['aperoListe', 'apero', '🍹'],
        ['entreeListe', 'entree', '🥗'],
        ['platListe', 'platPrincipal', '🥘'],
        ['dessertListe', 'dessert', '🍰'],
        ['autreListe', 'autre', '📦']
    ];

    cats.forEach(([elemId, key, icon]) => {
        const list = plats.filter(p => p.categorie === key && p.plat !== "Présence uniquement");
        const badge = document.getElementById('total-' + key);
        if (badge) badge.innerText = list.reduce((s, p) => s + parseInt(p.parts || 0), 0);

        document.getElementById(elemId).innerHTML = list.map(p => `
            <div class="plat-item">
                <span>${icon} <strong>${p.nom}</strong><br>${p.plat} (${p.parts}p)</span>
                ${p.ownerId === browserId ? `
                    <div style="display:flex; gap:5px;">
                        <button onclick="ouvrirModifPlat(${p.id})" class="btn-action">✏️</button>
                        <button onclick="supprimerPlat(${p.id})" class="btn-action">🗑️</button>
                    </div>` : ''}
            </div>
        `).join('') || '<div style="color:gray; font-size:0.8em; padding:5px;">Rien pour le moment</div>';
    });

    // Allergies
    const vus = new Set();
    const listeAllergies = plats.filter(p => {
        if (p.allergies && p.allergies.trim() !== "" && !vus.has(p.ownerId)) {
            vus.add(p.ownerId); return true;
        }
        return false;
    });
    document.getElementById('allergieListe').innerHTML = listeAllergies.map(p => `
        <div class="plat-item" style="border-left-color: #e74c3c;">
            <span>🚫 <strong>${p.nom}</strong><br>${p.allergies}</span>
        </div>
    `).join('') || '<div style="color:gray; font-size:0.8em; padding:5px;">Aucune allergie</div>';
}

// --- 3. ACTIONS ---

async function ajouterPlat() {
    const nomVal = document.getElementById('nomPersonne').value.trim();
    const convVal = document.getElementById('nbConvives').value;
    const platVal = document.getElementById('nouveauPlat').value.trim();
    const partsVal = document.getElementById('nombreParts').value || 0;
    const allergieVal = document.getElementById('allergieSaisie') ? document.getElementById('allergieSaisie').value.trim() : "";
    
    const radioCoche = document.querySelector('input[name="categoriePlat"]:checked');
    const catChoisie = radioCoche ? radioCoche.value : "autre";

    if (!nomVal) return alert("Le prénom est requis !");

    const btn = document.getElementById('btnAjouter');
    btn.disabled = true;
    btn.innerText = "Envoi...";

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "insert",
                nom: nomVal,
                convives: convVal || 0,
                plat: platVal || "Présence uniquement",
                parts: partsVal,
                categorie: catChoisie,
                allergies: allergieVal,
                browserId: browserId
            })
        });
        annulerEdition();
        await chargerDonnees();
    } catch (e) {
        alert("Erreur lors de l'envoi");
    } finally {
        btn.disabled = false;
        btn.innerText = "Valider mon plat";
    }
}

async function ajouterCommentaireDirect() {
    const nomVal = document.getElementById('nomPersonne').value.trim();
    const comVal = document.getElementById('commentaireSaisieSeule').value.trim();

    if (!nomVal) return alert("Saisissez votre prénom en haut pour signer !");
    if (!comVal) return alert("Le message est vide...");

    const btn = document.getElementById('btnCom');
    btn.disabled = true;
    btn.innerText = "Publication...";

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "insert",
                nom: nomVal,
                commentaire: comVal,
                plat: "Message Livre d'Or",
                browserId: browserId,
                convives: 0,
                parts: 0,
                categorie: "autre"
            })
        });
        document.getElementById('commentaireSaisieSeule').value = "";
        await chargerDonnees();
        alert("Message publié ! ✨");
    } catch (e) {
        alert("Erreur d'envoi");
    } finally {
        btn.disabled = false;
        btn.innerText = "Publier mon message";
    }
}

// --- 4. OUTILS ---

function annulerEdition() {
    document.getElementById('nouveauPlat').value = '';
    document.getElementById('nombreParts').value = '';
    document.getElementById('allergieSaisie').value = '';
    verifierSiDejaInscrit();
}

function verifierSiDejaInscrit() {
    const monInscription = plats.find(p => p.ownerId === browserId);
    const box = document.getElementById('boxConvives');
    const msgOk = document.getElementById('msgConvivesOk');
    const inputNom = document.getElementById('nomPersonne');

    if (monInscription) {
        box.style.display = "none";
        msgOk.style.display = "block";
        inputNom.value = monInscription.nom;
        inputNom.readOnly = true;
        inputNom.style.background = "#f0f0f0";
    }
}

function calculerStatsGlobales() {
    const vus = new Set();
    let totalConv = 0;
    plats.forEach(p => {
        if (!vus.has(p.ownerId)) {
            totalConv += parseFloat(p.convives || 0);
            vus.add(p.ownerId);
        }
    });
    document.getElementById('stat-convives').innerText = totalConv;
    document.getElementById('stat-total').innerText = plats.reduce((s, p) => s + parseInt(p.parts || 0), 0);
    verifierSiDejaInscrit();
}

// Modales simplifiées (logique existante conservée)
function ouvrirModifPlat(id) {
    const p = plats.find(x => x.id === id);
    if (!p) return;
    idEnEditionModale = id;
    document.getElementById('editPlatNom').value = p.plat;
    document.getElementById('editPlatParts').value = p.parts;
    document.getElementById('editPlatCat').value = p.categorie;
    document.getElementById('modalEdition').style.display = "block";
}
function fermerModale() { document.getElementById('modalEdition').style.display = "none"; }
// --- MODIF : Suppression par Timestamp ---

// Cette fonction ouvre la modale avec le bon message
/**function ouvrirModifCom(timestamp, ancienMessage) {
    comTimestampEnEdition = timestamp;
    comMessageOrigine = ancienMessage;

    // On remplit le textarea de la modale (vérifie que l'ID est bien 'editCom')
    const textarea = document.getElementById('editCom');
    if (textarea) textarea.value = ancienMessage;

    // On affiche la modale (vérifie que l'ID est bien 'modalLivreDor')
    const modale = document.getElementById('modalLivreDor');
    if (modale) modale.style.display = "block";
}
**/
function ouvrirModifCom(id, ancienMessage) {
    comIdEnEdition = id;
    document.getElementById('editCom').value = ancienMessage;
    document.getElementById('modalLivreDor').style.display = "block";
}

// Cette fonction envoie la modification au Google Sheet
/**
async function validerModifCom() {
    const nouveauMessage = document.getElementById('editCom').value.trim();

    // Si pas de changement ou vide, on ferme
    if (nouveauMessage === comMessageOrigine || nouveauMessage === "") {
        fermerModaleLivreDor();
        return;
    }

    fermerModaleLivreDor(); // Fermeture immédiate pour le confort visuel

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "updateCommentaire",
                timestamp: comTimestampEnEdition, // Utilisation de la date comme ID unique
                commentaire: nouveauMessage,
                browserId: browserId
            })
        });
        await chargerDonnees(); // Rafraîchir l'affichage
    } catch (e) {
        alert("Erreur lors de la modification");
        console.error(e);
    }
}
**/
async function validerModifCom() {
    const nouveauMessage = document.getElementById('editCom').value.trim();
    fermerModaleLivreDor();

    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: "updateCommentaire",
            messageId: comIdEnEdition,
            commentaire: nouveauMessage,
            browserId: browserId
        })
    });
    await chargerDonnees();
}

function fermerModaleLivreDor() {
    const modale = document.getElementById('modalLivreDor');
    if (modale) modale.style.display = "none";
    comTimestampEnEdition = null;
}
// Lancement
chargerDonnees();
setInterval(() => {
    const diff = DATE_COUSINADE - new Date();
    const jours = Math.floor(diff / (1000 * 60 * 60 * 24));
    document.getElementById("countdown").innerText = diff > 0 ? `J-${jours} avant la cousinade !` : "C'est le jour J ! 🎉";
}, 1000);
