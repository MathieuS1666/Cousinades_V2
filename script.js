/**
 * COUSINADE BOB 2026 - LOGIQUE FRONTEND
 * Liaison avec Google Sheets API
 */

const API_URL = "https://script.google.com/macros/s/AKfycbwGtC5vr3O0fVeledy_jrNb-17P6g-_jhZawAUpdf4Y4MsM64cGFEbkRelJnTIKg6w/exec";
const DATE_COUSINADE = new Date("2026-05-09T12:00:00");

let plats = [];
let idEnEditionModale = null;
let modeEdition = false; // Pour la logique d'ajout/modif du formulaire principal
let idEnCoursEdition = null;

// Génération ou récupération de l'ID unique du navigateur
let browserId = localStorage.getItem('cousinade_id') || ('user_' + Math.random().toString(36).substr(2, 9));
localStorage.setItem('cousinade_id', browserId);

// --- 1. CHARGEMENT DES DONNÉES ---

async function chargerPlats() {
    try {
        const response = await fetch(`${API_URL}?action=getPlats`);
        plats = await response.json();
        afficherPlats();
        calculerStatsGlobales();
    } catch (e) { 
        console.error("Erreur de chargement :", e); 
    }
}

// --- 2. STATISTIQUES ET AFFICHAGE ---

function calculerStatsGlobales() {
    // A. Calcul des convives uniques par browserId
    const vus = new Set();
    let totalConv = 0;
    plats.forEach(p => {
        if (!vus.has(p.ownerId)) {
            totalConv += parseFloat(p.convives || 0);
            vus.add(p.ownerId);
        }
    });

    // B. Mise à jour du bandeau (Stats globales)
    document.getElementById('stat-convives').innerText = totalConv;
    document.getElementById('stat-total').innerText = plats.reduce((s, p) => s + parseInt(p.parts || 0), 0);

    // C. Stats par catégories (Bandeau)
    const statsMapping = {
        'apero': 'stat-apero',
        'entree': 'stat-entrees',
        'platPrincipal': 'stat-plats',
        'dessert': 'stat-desserts'
    };

    Object.keys(statsMapping).forEach(key => {
        const total = plats.filter(p => p.categorie === key).reduce((s, p) => s + parseInt(p.parts || 0), 0);
        const element = document.getElementById(statsMapping[key]);
        if (element) element.innerText = total;
    });

    // D. Liste des présents
    const unique = {};
    plats.forEach(p => { if (!unique[p.nom]) unique[p.nom] = p; });
    document.getElementById('listePresents').innerHTML = Object.values(unique).map(p => `
        <span class="badge-present"><strong>${p.nom}</strong> : ${p.convives}
        ${p.ownerId === browserId ? `<button onclick="ouvrirModifConvives(${p.id})" class="btn-edit-small">✏️</button>` : ''}</span>
    `).join('');

// E. Livre d'or (Avec bouton supprimer)
    const messages = plats.filter(p => p.commentaire && p.commentaire.trim() !== "");
    document.getElementById('livreDor').innerHTML = messages.map(m => `
        <div class="com-card" style="background:#fff9e6; padding:15px; border-radius:10px; border-left:5px solid #feca57; position:relative; box-shadow: 2px 2px 5px rgba(0,0,0,0.05);">
            
            ${m.ownerId === browserId ? `
                <div style="position:absolute; top:10px; right:10px; display:flex; gap:5px;">
                    <button onclick="ouvrirModifCom('${m.nom}')" title="Modifier" style="background:none;border:none;cursor:pointer;font-size:1.1em;padding:0;">✏️</button>
                    <button onclick="supprimerCommentaire('${m.nom}')" title="Supprimer" style="background:none;border:none;cursor:pointer;font-size:1.1em;padding:0;">🗑️</button>
                </div>
            ` : ''}

            <p style="margin:0; font-style:italic; white-space:pre-wrap; color:#444; padding-right:40px;">"${m.commentaire}"</p>
            <p style="margin:10px 0 0 0; text-align:right; font-weight:bold; font-size:0.8em; color:#2c3e50;">— ${m.nom}</p>
        </div>
    `).join('') || '<p style="grid-column:1/-1;text-align:center;color:gray;">Aucun message pour le moment...</p>';
    
    verifierSiDejaInscrit();
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
                        <button onclick="ouvrirModifPlat(${p.id})" title="Modifier" class="btn-action">✏️</button>
                        <button onclick="supprimerPlat(${p.id})" title="Supprimer" class="btn-action">🗑️</button>
                    </div>` : ''}
            </div>
        `).join('') || '<div style="color:gray; font-size:0.8em; padding:5px;">Rien pour le moment</div>';
    });
}

// --- 3. GESTION DU FORMULAIRE (AJOUT) ---

async function ajouterPlat() {
    const radioCoche = document.querySelector('input[name="categoriePlat"]:checked');
    const catChoisie = radioCoche ? radioCoche.value : "autre";

    // On récupère les valeurs
    const nomVal = document.getElementById('nomPersonne').value.trim();
    const convVal = document.getElementById('nbConvives').value;
    const platVal = document.getElementById('nouveauPlat').value.trim();
    const comVal = document.getElementById('commentaire').value.trim();

    // --- LA CORRECTION ICI ---
    // On n'alerte QUE si le nom est vide. 
    // Le nombre de convives n'est requis que si on n'est pas encore inscrit (donc si le champ est visible)
    const estDejaInscrit = document.getElementById('boxConvives').style.display === "none";
    
    if (!nomVal) return alert("Le prénom est requis !");
    if (!estDejaInscrit && !convVal) return alert("Le nombre de personnes est requis pour votre première inscription !");
    
    // Si tout est vide (pas de plat ET pas de commentaire), on ne fait rien
    if (!platVal && !comVal && platVal !== "Présence uniquement") {
        return alert("Veuillez saisir un plat ou un petit mot !");
    }
    // --------------------------

    const fields = {
        nom: nomVal,
        convives: convVal || 0, // On envoie 0 ou l'ancienne valeur si masqué
        plat: platVal || "Présence uniquement",
        parts: document.getElementById('nombreParts').value || 0,
        categorie: catChoisie,
        commentaire: comVal,
        action: modeEdition ? "update" : "insert",
        rowId: idEnCoursEdition,
        browserId: browserId
    };

    const btn = document.getElementById('btnAjouter');
    btn.disabled = true;
    btn.innerText = "Envoi...";

    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify(fields) });
        annulerEdition();
        await chargerPlats();
    } catch (e) {
        alert("Erreur lors de l'envoi, réessaye !");
    } finally {
        btn.disabled = false;
        btn.innerText = "Valider";
    }
}

function annulerEdition() {
    modeEdition = false; 
    idEnCoursEdition = null;
    // Nettoyage des champs texte et nombre
    document.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(i => i.value = '');
    // Désélection des radios
    document.querySelectorAll('input[name="categoriePlat"]').forEach(r => r.checked = false);
    document.getElementById('btnAnnuler').style.display = "none";
    verifierSiDejaInscrit();
}

// --- 4. GESTION DE LA MODALE (MODIFICATION RAPIDE) ---

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

async function validerModifModale() {
    const p = plats.find(x => x.id === idEnEditionModale);
    const nouveauxChamps = {
        action: "update",
        rowId: idEnEditionModale,
        nom: p.nom,
        convives: p.convives,
        plat: document.getElementById('editPlatNom').value.trim(),
        parts: document.getElementById('editPlatParts').value,
        categorie: document.getElementById('editPlatCat').value,
        browserId: browserId
    };

    fermerModale();
    await fetch(API_URL, { method: 'POST', body: JSON.stringify(nouveauxChamps) });
    await chargerPlats();
}

// --- 5. MODIFICATIONS SPÉCIFIQUES (PROMPT) ---

async function ouvrirModifConvives(id) {
    const p = plats.find(x => x.id === id);
    let saisi = prompt(`Modifier le nombre de personnes pour ${p.nom} :`, p.convives);
    if (saisi === null) return;

    let num = parseFloat(saisi.replace(',', '.'));
    if (isNaN(num)) {
        alert("Ce n'est pas un nombre !");
        return ouvrirModifConvives(id); 
    }

    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ 
            action: "update", rowId: id, nom: p.nom, convives: num, 
            plat: p.plat, parts: p.parts, categorie: p.categorie, browserId: browserId 
        })
    });
    await chargerPlats();
}

async function ouvrirModifCom(nom) {
    const p = plats.find(x => x.nom === nom && x.commentaire);
    const nouveau = prompt("Modifier votre message :", p ? p.commentaire : "");
    if (nouveau === null) return;
    await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: "updateCommentaire", nom: nom, commentaire: nouveau, browserId: browserId })
    });
    await chargerPlats();
}

async function supprimerPlat(id) {
    if (!confirm("Supprimer ce plat ?")) return;
    await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: "delete", rowId: id, browserId: browserId })
    });
    await chargerPlats();
}

// --- 6. UTILITAIRES ET UI ---

function verifierSiDejaInscrit() {
    const monInscription = plats.find(p => p.ownerId === browserId);
    const boxConvives = document.getElementById('boxConvives');
    const msgOk = document.getElementById('msgConvivesOk');
    const inputNom = document.getElementById('nomPersonne');

    if (monInscription) {
        boxConvives.style.display = "none";
        msgOk.style.display = "block";
        inputNom.value = monInscription.nom;
        inputNom.readOnly = true;
        inputNom.style.background = "#f0f0f0";
    } else {
        boxConvives.style.display = "block";
        msgOk.style.display = "none";
        inputNom.readOnly = false;
        inputNom.style.background = "white";
    }
}

function mettreAJourCompteARebours() {
    const diff = DATE_COUSINADE - new Date();
    if (diff <= 0) {
        document.getElementById("countdown").innerText = "C'est le jour J ! 🎉";
        return;
    }
    const jours = Math.floor(diff / (1000 * 60 * 60 * 24));
    document.getElementById("countdown").innerText = `J-${jours} avant la cousinade !`;
}

function ouvrirAdmin() {
    if (prompt("Pass :") === "1234") {
        window.open("https://docs.google.com/spreadsheets/d/1ouuhTU8QERvZwBimUb-VrpOR4lpkjv8WGlsBqKuFZa8/edit?usp=sharing");
    }
}
async function supprimerCommentaire(nom) {
    if (!confirm("Voulez-vous supprimer votre message du livre d'or ?")) return;

    await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ 
            action: "updateCommentaire", 
            nom: nom, 
            commentaire: "", // Envoyer un texte vide pour "supprimer"
            browserId: browserId 
        })
    });
    
    await chargerPlats();
}
// --- LANCEMENT ---
mettreAJourCompteARebours();
chargerPlats();
