/**
 * COUSINADE BOB 2026 - LOGIQUE FRONTEND
 * Ce fichier gère l'affichage, les inscriptions et le livre d'or.
 */

// ==========================================
// 1. CONFIGURATION & VARIABLES GLOBALES
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycby6mZtTpmD5yi4aP3yx1rWbQ8H0jtEWTqaUghZpHU86IteUAaAWEDM4dJyImmPh6t6_/exec";
const DATE_COUSINADE = new Date("2026-05-09T12:00:00");

let plats = [];
let commentaires = []; 
let idEnEditionModale = null; // ID du plat en cours de modification
let comIdEnEdition = null;    // ID du commentaire en cours de modification

// Identifiant unique du navigateur pour savoir qui possède quel plat/message
let browserId = localStorage.getItem('cousinade_id') || ('user_' + Math.random().toString(36).substr(2, 9));
localStorage.setItem('cousinade_id', browserId);

// ==========================================
// 2. CŒUR DU SCRIPT (CHARGEMENT & STATS)
// ==========================================

/**
 * Récupère toutes les données du Google Sheet
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
 * Calcule les statistiques de présence et de nourriture
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
 * Affiche les messages du livre d'or
 */
function afficherLivreDor() {
    const container = document.getElementById('livreDor');
    if (!container) return;

    container.innerHTML = commentaires.map(m => {
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
 * Publie un nouveau message
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
 * Valide la modification d'un message existant
 */
async function validerModifCom() {
    const nouveauMessage = document.getElementById('editCom').value.trim();
    fermerModaleLivreDor();

    try {
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
    } catch (e) {
        alert("Erreur lors de la modification");
    }
}

/**
 * Supprime un message (envoie une chaîne vide)
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
 * Affiche la liste des plats par catégories
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

    // Liste des allergies (sans doublons de personne)
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
 * Ajoute un nouveau plat
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

/**
 * Valide la modification d'un plat depuis la modale
 */
async function validerModif() {
    const plat = document.getElementById('editPlatNom').value;
    const parts = document.getElementById('editPlatParts').value;
    const cat = document.getElementById('editPlatCat').value;
    const nom = document.getElementById('nomPersonne').value;
    const conv = document.getElementById('nbConvives') ? document.getElementById('nbConvives').value : 0;

    fermerModale();

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "update",
                rowId: idEnEditionModale,
                nom: nom,
                plat: plat,
                parts: parts,
                categorie: cat,
                convives: conv,
                browserId: browserId
            })
        });
        await chargerDonnees();
    } catch (e) {
        alert("Erreur lors de la modification");
    }
}

/**
 * Supprime un plat
 */
async function supprimerPlat(id) {
    if (!confirm("Supprimer ce plat ?")) return;
    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "delete", rowId: id, browserId: browserId })
        });
        await chargerDonnees();
    } catch (e) {
        alert("Erreur lors de la suppression");
    }
}

// ==========================================
// 5. UTILITAIRES & MODALES
// ==========================================

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

function annulerEdition() {
    document.getElementById('nouveauPlat').value = '';
    document.getElementById('nombreParts').value = '';
    if(document.getElementById('allergieSaisie')) document.getElementById('allergieSaisie').value = '';
    verifierSiDejaInscrit();
}

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
    document.getElementById('modalLivreDor').style.display = "none";
    comIdEnEdition = null;
}

// ==========================================
// 6. INITIALISATION & COMPTEUR
// ==========================================

// Lancement initial
chargerDonnees();

// Mise à jour du compte à rebours chaque seconde
setInterval(() => {
    const diff = DATE_COUSINADE - new Date();
    const jours = Math.floor(diff / (1000 * 60 * 60 * 24));
    const countdownElem = document.getElementById("countdown");
    if (countdownElem) {
        countdownElem.innerText = diff > 0 ? `J-${jours} avant la cousinade !` : "C'est le jour J ! 🎉";
    }
}, 1000);
