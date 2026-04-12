/**
 * COUSINADE BOB 2026 - LOGIQUE FRONTEND
 */

const API_URL = "https://script.google.com/macros/s/AKfycbznZlmSWqyOrjs1e0wsaASKaAJw8qltFrDYb5AjrGjzA8v-2z7kzs5G56ZKcxMYBtQk/exec";
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
function afficherLivreDor() {
    const container = document.getElementById('livreDor');
    if (!container) return;

    // On trie par date (le plus récent en premier)
    container.innerHTML = commentaires.map(m => {
        // On crée un ID unique basé sur l'horodatage pour le JS
        const messageId = m.date; 

        return `
        <div class="com-card" style="background:#fff9e6; padding:15px; border-radius:10px; border-left:5px solid #feca57; position:relative; margin-bottom:10px;">
            ${m.ownerId === browserId ? `
                <div style="position:absolute; top:10px; right:10px; display:flex; gap:5px;">
                    <button onclick="ouvrirModifCom('${messageId}', '${m.commentaire.replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer;">✏️</button>
                    <button onclick="supprimerCommentaire('${messageId}')" style="background:none; border:none; cursor:pointer;">🗑️</button>
                </div>
            ` : ''}
            <p style="margin:0; font-style:italic; white-space:pre-wrap; color:#444;">"${m.commentaire}"</p>
            <p style="margin:10px 0 0 0; text-align:right; font-weight:bold; font-size:0.8em; color:#999;">
                Le ${new Date(m.date).toLocaleDateString('fr-FR')} par ${m.nom}
            </p>
        </div>
    `}).join('') || '<p style="text-align:center;color:gray;">Aucun message...</p>';
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
async function supprimerCommentaire(timestamp) {
    if (!confirm("Voulez-vous supprimer ce message ?")) return;
    await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ 
            action: "updateCommentaire", 
            timestamp: timestamp, // On envoie l'heure exacte du message
            commentaire: "", 
            browserId: browserId 
        })
    });
    await chargerDonnees();
}
// Variables pour mémoriser ce qu'on modifie
let comTimestampEnEdition = null;
let comMessageOrigine = null;

// Cette fonction ouvre la modale avec le bon message
function ouvrirModifCom(timestamp, ancienMessage) {
    comTimestampEnEdition = timestamp;
    comMessageOrigine = ancienMessage;

    // On remplit le textarea de la modale (vérifie que l'ID est bien 'editCom')
    const textarea = document.getElementById('editCom');
    if (textarea) textarea.value = ancienMessage;

    // On affiche la modale (vérifie que l'ID est bien 'modalLivreDor')
    const modale = document.getElementById('modalLivreDor');
    if (modale) modale.style.display = "block";
}

// Cette fonction envoie la modification au Google Sheet
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
