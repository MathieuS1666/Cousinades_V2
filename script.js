const API_URL = "https://script.google.com/macros/s/AKfycbwwhW9cFyxJoCOHHErW8SBKB9r2sAKs1o1EdNDcpJdO2eOWvJ_qtUO8KJF6qoz2gokK/exec";
const DATE_COUSINADE = new Date("2026-05-09T12:00:00");
let plats = [];
let modeEdition = false;
let idEnCoursEdition = null;
let browserId = localStorage.getItem('cousinade_id') || ('user_' + Math.random().toString(36).substr(2, 9));
localStorage.setItem('cousinade_id', browserId);

function verifierSiDejaInscrit() {
    // On cherche si un plat possède ton browserId
    const monInscription = plats.find(p => p.ownerId === browserId);
    const boxConvives = document.getElementById('boxConvives');
    const inputNom = document.getElementById('nomPersonne');
    const inputNbConvives = document.getElementById('nbConvives');

    if (monInscription) {
        // Si je suis déjà inscrit :
        // 1. On cache la boite orange du nombre de personnes
        boxConvives.style.display = "none";
        msgConviviesOk.style.display = "block"; // ON AFFICHE LE MESSAGE ✅
        // 2. On pré-remplit le nom et le nombre (pour les envois de plats suivants)
        inputNom.value = monInscription.nom;
        inputNbConvives.value = monInscription.convives;
        // 3. On peut éventuellement griser le nom pour ne pas le changer
        inputNom.readOnly = true;
        inputNom.style.background = "#f0f0f0";
    } else {
        // Si je ne suis pas inscrit, on affiche tout normalement
        boxConvives.style.display = "block";
        msgConvivesOk.style.display = "none"; // ON CACHE LE MESSAGE
        inputNom.readOnly = false;
        inputNom.style.background = "white";
    }
}

async function chargerPlats() {
    try {
        const response = await fetch(`${API_URL}?action=getPlats`);
        plats = await response.json();
        afficherPlats();
        calculerStatsGlobales();
    } catch (e) { console.error(e); }
}

function calculerStatsGlobales() {
    // 1. Stats globales
    const vus = new Set(); let totalConv = 0;
    plats.forEach(p => { if(!vus.has(p.ownerId)){ totalConv += parseFloat(p.convives||0); vus.add(p.ownerId); }});
    document.getElementById('stat-convives').innerText = totalConv;
    document.getElementById('stat-total').innerText = plats.reduce((s,p)=>s+parseInt(p.parts||0),0);

    // 2. Stats par catégories (Bandeau)
    document.getElementById('stat-apero').innerText = plats.filter(p => p.apero).reduce((s,p)=>s+parseInt(p.parts||0),0);
    document.getElementById('stat-entrees').innerText = plats.filter(p => p.entree).reduce((s,p)=>s+parseInt(p.parts||0),0);
    document.getElementById('stat-plats').innerText = plats.filter(p => p.platPrincipal).reduce((s,p)=>s+parseInt(p.parts||0),0);
    document.getElementById('stat-desserts').innerText = plats.filter(p => p.dessert).reduce((s,p)=>s+parseInt(p.parts||0),0);

    // 3. Liste présents
    const unique = {};
    plats.forEach(p => { if(!unique[p.nom]) unique[p.nom] = p; });
    document.getElementById('listePresents').innerHTML = Object.values(unique).map(p => `
        <span class="badge-present"><strong>${p.nom}</strong> : ${p.convives}
        ${p.ownerId===browserId ? `<button onclick="ouvrirModifConvives(${p.id})" style="background:none;border:none;cursor:pointer;width:auto;display:inline;padding:0;margin-left:5px;">✏️</button>` : ''}</span>
    `).join('');

    // 4. Livre d'or
    const messages = plats.filter(p => p.commentaire && p.commentaire.trim() !== "");
    document.getElementById('livreDor').innerHTML = messages.map(m => `
        <div style="background:#fff9e6; padding:15px; border-radius:10px; border-left:5px solid #feca57; position:relative; box-shadow: 2px 2px 5px rgba(0,0,0,0.05);">
            ${m.ownerId===browserId ? `<button onclick="ouvrirModifCom('${m.nom}')" style="float:right;background:none;border:none;cursor:pointer;font-size:1.2em;">✏️</button>` : ''}
            <p style="margin:0; font-style:italic; white-space:pre-wrap; color:#444;">"${m.commentaire}"</p>
            <p style="margin:10px 0 0 0; text-align:right; font-weight:bold; font-size:0.8em; color:#2c3e50;">— ${m.nom}</p>
        </div>
    `).join('') || '<p style="grid-column:1/-1;text-align:center;color:gray;">Aucun message pour le moment...</p>';
verifierSiDejaInscrit();
}

async function ouvrirModifConvives(id) {
    const p = plats.find(x => x.id === id);
    const nouveau = prompt(`Modifier le nombre de personnes pour ${p.nom} :`, p.convives);
    if (nouveau !== null && nouveau.trim() !== "") {
        await envoyerUpdate(id, p.nom, nouveau, p.plat, p.parts, p.apero, p.entree, p.platPrincipal, p.dessert, p.autre);
    }
}

async function ouvrirModifPlat(id) {
    const p = plats.find(x => x.id === id);
    const nouveauNom = prompt("Nom du plat :", p.plat === "Présence uniquement" ? "" : p.plat);
    if (nouveauNom === null) return;
    const nouvellesParts = prompt("Pour combien de personnes ?", p.parts);
    if (nouvellesParts === null) return;

    await envoyerUpdate(id, p.nom, p.convives, nouveauNom, nouvellesParts, p.apero, p.entree, p.platPrincipal, p.dessert, p.autre);
}

async function envoyerUpdate(id, nom, conv, plat, parts, apero, entree, pp, dess, aut) {
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "update", rowId: id, nom: nom, convives: conv, plat: plat, parts: parts, apero: apero, entree: entree, platPrincipal: pp, dessert: dess, autre: aut, browserId: browserId })
    });
    await chargerPlats();
}

async function ouvrirModifCom(nom) {
    const p = plats.find(x => x.nom === nom && x.commentaire);
    const nouveau = prompt("Modifier votre message :", p ? p.commentaire : "");
    if(nouveau === null) return;
    await fetch(API_URL, { method: 'POST', body: JSON.stringify({action: "updateCommentaire", nom: nom, commentaire: nouveau, browserId: browserId})});
    await chargerPlats();
}

async function ajouterPlat() {
    const catChoisie = document.querySelector('input[name="categoriePlat"]:checked')?.value || "autre";

    const fields = {
        nom: document.getElementById('nomPersonne').value.trim(),
        convives: document.getElementById('nbConvives').value,
        plat: document.getElementById('nouveauPlat').value.trim() || "Présence uniquement",
        parts: document.getElementById('nombreParts').value || 0,
        categorie: catChoisie, // On envoie juste le nom de la catégorie
        commentaire: document.getElementById('commentaire').value.trim(),
        action: modeEdition ? "update" : "insert",
        rowId: idEnCoursEdition,
        browserId: browserId
    };
    if(!fields.nom || !fields.convives) return alert("Nom et Convives requis");

    document.getElementById('btnAjouter').disabled = true;
    await fetch(API_URL, { method: 'POST', body: JSON.stringify({...fields, action: modeEdition?"update":"insert", rowId: idEnCoursEdition, browserId: browserId})});
    annulerEdition();
    await chargerPlats();
    document.getElementById('btnAjouter').disabled = false;
}

function annulerEdition() {
    modeEdition = false; idEnCoursEdition = null;
    document.querySelectorAll('input, textarea').forEach(i => { if(i.type==='checkbox') i.checked=false; else i.value=''; });
    document.getElementById('btnAnnuler').style.display = "none";
}

async function supprimerPlat(id) {
    if(!confirm("Supprimer ce plat ?")) return;
    await fetch(API_URL, { method: 'POST', body: JSON.stringify({action:"delete", rowId:id, browserId:browserId})});
    await chargerPlats();
}

function afficherPlats() {
    const categories = [
        { id: 'aperoListe', key: 'apero', icon: '🍹' },
        { id: 'entreeListe', key: 'entree', icon: '🥗' },
        { id: 'platListe', key: 'platPrincipal', icon: '🥘' },
        { id: 'dessertListe', key: 'dessert', icon: '🍰' },
        { id: 'autreListe', key: 'autre', icon: '📦' }
    ];

    categories.forEach(cat => {
        // On filtre simplement sur la colonne .categorie
        const list = plats.filter(p => p.categorie === cat.key && p.plat !== "Présence uniquement");
        
        document.getElementById('total-' + cat.key).innerText = list.reduce((s,p) => s + parseInt(p.parts || 0), 0);
        document.getElementById(cat.id).innerHTML = list.map(p => `
            <div class="plat-item">
                <span>${cat.icon} <strong>${p.nom}</strong><br>${p.plat} (${p.parts}p)</span>
                ${p.ownerId === browserId ? `<button onclick="ouvrirModifPlat(${p.id})">✏️</button>` : ''}
            </div>
        `).join('') || '-';
    });
}

function ouvrirAdmin() { if(prompt("Pass :")==="1234") window.open("https://docs.google.com/spreadsheets/d/TON_ID_SHEET"); }
function mettreAJourCompteARebours() {
    const maintenant = new Date();
    const difference = DATE_COUSINADE - maintenant;

    if (difference <= 0) {
        document.getElementById("countdown").innerText = "C'est le jour J ! 🎉";
        return;
    }

    const jours = Math.floor(difference / (1000 * 60 * 60 * 24));

    document.getElementById("countdown").innerText = 
        `J-${jours} avant la cousinade !`;
}

// On lance le calcul immédiatement
mettreAJourCompteARebours();
// Lancement au chargement
chargerPlats();
