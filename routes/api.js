const express = require('express');
const router = express.Router();
const request = require('request');
const models = require("../models/index");
const { Op } = require("sequelize");
const moment = require('moment');
const rp = require('request-promise');
const axios = require('axios').default

const FORMAT_DATE = 'YYYY-MM-DD'

// vérifie que la requête provient bien d'ezqual
function authorized(req, res) {

}

// stock en mémoire une liste à jour des vendeurs sur ezqual
async function getListeVendeurs() {
    const today = moment()

    if(global.objetListeisteVendeurs === undefined || (global.objetListeisteVendeurs.lastUpdate.diff(today, 'days') !== 0)) {
        try {
            const response = await axios({
                method : 'GET',
                // url : `http://localhost/ezqual/api/getVendeurs.php`,
                url : `http://ezqual.fr/api/getVendeurs.php`,
                responseType : 'json'
            })

            if(response.status !== 200) {
                throw `Erreur lors de la récupération de la liste des vendeurs : ${response.statusText}`
            }
    
            const data = response.data

            global.objetListeisteVendeurs = {
                liste : data,
                lastUpdate : moment()
            }
            console.log('MAJ LISTE VENDEURS')
        }
        catch(error) {
            console.error(error)
        }
    }

    return global.objetListeisteVendeurs.liste
}

// stock en mémoire une liste à jour des telepros sur ezqual
async function getListeTelepros() {
    const today = moment()

    if(global.objetListeisteTelepros === undefined || (global.objetListeisteTelepros.lastUpdate.diff(today, 'days') !== 0)) {
        try {
            const response = await axios({
                method : 'GET',
                // url : `http://localhost/ezqual/api/getTelepros.php`,
                url : `http://ezqual.fr/api/getTelepros.php`,
                responseType : 'json'
            })

            if(response.status !== 200) {
                throw `Erreur lors de la récupération de la liste des telepros : ${response.statusText}`
            }
    
            const data = response.data

            global.objetListeisteTelepros = {
                liste : data,
                lastUpdate : moment()
            }
            console.log('MAJ LISTE TELEPROS')
        }
        catch(error) {
            console.error(error)
        }
    }

    return global.objetListeisteTelepros.liste
}

async function getIdUser(search) {
    const telepro = await models.User.findOne({
        where : search
    })

    return isSet(telepro) ? telepro.id : null
}

async function getIdTeleproByPrenom(prenom) {
    const listeTelepros = await getListeTelepros()

    const telepro = listeTelepros.filter(telepro => {
        const reg = new RegExp(prenom, 'ig')
        return !!telepro.prenom.match(reg)
    })[0]
    
    if(telepro === undefined) return null
    
    return await getIdUser({
        /*les nom entre ezqual et fuego ne correspondent pas toujours pour les telepros
        nom : telepro.nom,*/
        prenom : models.sequelize.where(models.sequelize.fn('LOWER', models.sequelize.col('prenom')), 'LIKE', `%${telepro.prenom.toLowerCase()}%`),
        mail : telepro.mail
    })
}

async function getIdTeleproByEmail(mail) {
    return await getIdUser({
        mail : mail
    })
}

async function getIdVendeur(mail) {
    const listeVendeurs = await getListeVendeurs()

    const vendeur = listeVendeurs.filter(vendeur => {
        const reg = new RegExp(mail, 'ig')
        return !!vendeur.mail.match(reg)
    })[0]

    if(vendeur === undefined) return null

    // recherche uniquement par nom prenom
    return await getIdUser({
        prenom : vendeur.prenom,
        nom : vendeur.nom
    })
}

function isSet(val) {
    if(val === '' || val === undefined || val === 'undefined' || val === null || val === 'NULL') {
        return false
    }

    return true
}

router
.get('/test', async (req, res) => {
    const id = await getIdTeleproByPrenom('super')
    
    res.send(`id : ${id}`)
})
.post('/affichePost', async (req, res) => {
    console.log(req.body)
    const json = await JSON.stringify(req.body)
    console.log(json)
    res.status(200).end()
})
// ajoute un rdv depuis ezqual
// TODO: voir pour aouter un méchanisme qui informe qu'il y a eu une erreur
.post('/ajouteClient/:idClientEzqual', async (req, res) => {
    const paramIdClientEzqual = req.params.idClientEzqual

    if(!isSet(paramIdClientEzqual)) {
        res.end()
    }

    try {
        const response = await axios({
            method : 'GET',
            url : `http://ezqual.fr/clientstofuego.php?id=${paramIdClientEzqual}`,
            // url : `http://localhost/ezqual/clientstofuego.php?id=${paramIdClientEzqual}`,
            responseType : 'json'
        })

        const data = response.data

        const temp_client = {
            id_hitech : isSet(data.id_hitech) ? data.id_hitech : null,
            nom : isSet(data.nom) ? data.nom.toUpperCase() : null,
            prenom : isSet(data.prenom) ? data.prenom.toUpperCase() : null,
            tel1 : isSet(data.tel1) ? formatPhone(data.tel1) : null,
            tel2 : isSet(data.tel2) ? formatPhone(data.tel2) : null,
            tel3 : isSet(data.tel3) ? formatPhone(data.tel3) : null,
            adresse : isSet(data.adresse) ? data.adresse.toUpperCase() : null,
            cp : isSet(data.cp) ? data.cp : null,
            dep : isSet(data.cp) ? data.cp.toString().substr(0,2) : null,
            ville : isSet(data.ville) ? data.ville.toUpperCase() : null,
            relation : isSet(data.situafam) ? data.situafam.toUpperCase() : null,
            pro1 : isSet(data.situapro) ? data.situapro.toUpperCase() : null, 
            pdetail1 : isSet(data.situapro_pres) ? data.situapro_pres.toUpperCase() : null,
            age1 : isSet(data.age) ? parseInt(data.age) : null,
            pro2 : isSet(data.situapro2) ? data.situapro2.toUpperCase() : null,
            pdetail2 : isSet(data.situapro2_pres) ? data.situapro2_pres.toUpperCase() : null,
            fioul : isSet(data.x_qualif_fioul) ? (data.x_qualif_fioul === 'True' ? 1 : 0) : null,
            gaz : isSet(data.x_qualif_gaz) ? (data.x_qualif_gaz === 'True' ? 1 : 0) : null,
            elec : isSet(data.x_qualif_elec) ? (data.x_qualif_elec === 'True' ? 1 : 0) : null,
            bois : isSet(data.x_qualif_bois) ? (data.x_qualif_bois === 'True' ? 1 : 0) : null,
            pac : isSet(data.x_qualif_pac) ? (data.x_qualif_pac === 'True' ? 1 : 0) : null,
            autre : isSet(data.x_qualif_autre) ? (data.x_qualif_autre === 'True' ? 1 : 0) : null,
            fchauffage : isSet(data.montant_facture) ? data.montant_facture : null,
            surface : isSet(data.sup) ? data.sup : null,
            panneaux : isSet(data.x_qualif_panneaux) ? (data.x_qualif_panneaux === 'True' ? 1 : 0) : null,
            annee : isSet(data.pv) ? data.pv : null,
            be : isSet(data.bilan) ? (data.bilan === 'True' ? 1 : 0) : null,
            commentaire : isSet(data.commentaire) ? data.commentaire : null,
            source : isSet(data.source) ? data.source : null,
            type : isSet(data.x_type_campagne) ? data.x_type_campagne : null
        }

        let client = undefined

        // recherche du client par id_hitech ou nom + prenom + cp + tel1
        //  crée le client s'il n'existe pas
        const [clientDB, created] = await models.Client.findCreateFind({
            where : {
                [Op.or] : [
                    { 
                        id_hitech : {
                            [Op.like] : temp_client.id_hitech
                        }
                    },
                    {
                        [Op.and] : [
                            { nom : temp_client.nom },
                            { prenom : temp_client.prenom },
                            { cp : temp_client.cp },
                            { tel1 : temp_client.tel1 }
                        ]
                    }
                ]                
            },
            defaults : temp_client
        })

        client = clientDB
        console.log(`created : ${created}`)

        // si nouveau client ajouter tout son historique
        if(created) {
            for(const rdv of data.rdv) {
                const historique = await models.Historique.create({
                    idAction : 1,
                    dateevent : moment(rdv.daterdv),
                    commentaire : isSet(rdv.cr) ? rdv.cr.obsvente : null,
                    idClient : client.id,
                    // idUser : tabUser[rdv.telepro],
                    idUser : await getIdTeleproByPrenom(rdv.telepro),
                    createdAt : moment(rdv.dateappel)
                })

                // ajout de l'historique au client
                client.update({
                    currentAction : historique.idAction,
                    currentUser : historique.idUser
                })

                const createdRDV = await models.RDV.create({
                    idClient : client.id,
                    idHisto : historique.id,
                    idVendeur : await getIdVendeur(rdv.referen),
                    source : rdv.origine,
                    statut : listeStatutRDV[rdv.etat] !== undefined ? listeStatutRDV[rdv.etat] : listeStatutRDV['Non Confirmé'],
                    // TODO: gérer les états
                    // idEtat : isSet(rdv.cr) tabEtat[rdv.etat] !== undefined ? tabEtat[rdv.etat] : '15',
                    commentaire : isSet(rdv.cr) ? rdv.cr.obsvente : null,
                    date : moment(rdv.daterdv)
                })

                historique.update({
                    idRdv : createdRDV.id
                })
            }

            if(data.statut !== 'RDV' && data.statut !== 'A TRAITER') {
                const historique = await models.Historique.create({
                    idAction : tabStatut[data.statut],
                    idClient : client.id,
                    // idUser : tabStatClick[data.idtelepro],
                    idUser : await getIdTeleproByEmail(data.idtelepro),
                    createdAt : moment(data.datetraitement)
                })

                client.update({
                    currentAction : historique.idAction,
                    currentUser : historique.idUser
                })
            }
        }
        // si nouveau rdv pour client connu, ajouter seulement son dernier rdv s'il n'existe pas déjà
        else {
            const rdv = data.rdv[data.rdv.length - 1]

            const temp_historique = {
                idAction : 1,
                dateevent : moment(rdv.daterdv),
                commentaire : isSet(rdv.cr) ? rdv.cr.obsvente : null,
                idClient : client.id,
                // idUser : tabUser[rdv.telepro],
                idUser : await getIdTeleproByPrenom(rdv.telepro),
                createdAt : moment(rdv.dateappel)
            }

            const [historique, nouvelHistorique] = await models.Historique.findCreateFind({
                where : temp_historique,
                defaults : temp_historique
            })

            if(nouvelHistorique) {
                // ajout de l'historique au client
                client.update({
                    currentAction : historique.idAction,
                    currentUser : historique.idUser
                })

                const createdRDV = await models.RDV.create({
                    idClient : client.id,
                    idHisto : historique.id,
                    idVendeur : await getIdVendeur(rdv.referen),
                    source : rdv.origine,
                    statut : listeStatutRDV[rdv.etat] !== undefined ? listeStatutRDV[rdv.etat] : listeStatutRDV['Non Confirmé'],
                    // TODO: gérer les états
                    // idEtat : tabEtat[rdv.etat] !== undefined ? tabEtat[rdv.etat] : '15',
                    commentaire : isSet(rdv.cr) ? rdv.cr.obsvente : null,
                    date : moment(rdv.daterdv)
                })

                historique.update({
                    idRdv : createdRDV.id
                })
            }
        }

        const tabPromisesAppels = []
        for(const appel of data.appels) {
            // valeurs de l'appel
            const temp_appel = {
                idAction : 2,
                idClient : client.id,
                idUser : tabStatClick[appel.telepro],
                createdAt : moment(appel.dateclick)
            }

            // création uniquement des nouveaux appels
            tabPromisesAppels.push(models.Historique.findCreateFind({
                where : temp_appel,
                defaults : temp_appel
            }))
        }
        Promise.all(tabPromisesAppels)
    }
    catch(error) {
        console.error(error)
    }
    finally {
        res.end()
    }
})
// ajoute rdv et update client
.post('/ajouteRDV', async (req, res) => {
    const data = req.body
    
    try {
        const clientOldValues = {
            id_hitech : isSet(data.clientOld.id_hitech) ? data.clientOld.id_hitech : null,
            nom : isSet(data.clientOld.nom) ? data.clientOld.nom.toUpperCase() : null,
            prenom : isSet(data.clientOld.prenom) ? data.clientOld.prenom.toUpperCase() : null,
            tel1 : isSet(data.clientOld.tel1) ? formatPhone(data.clientOld.tel1) : null,
            cp : isSet(data.clientOld.cp) ? data.clientOld.cp : null
        }

        // recherche du client
        const client = await models.Client.findOne({
            where : {
                [Op.or] : [
                    { 
                        id_hitech : {
                            [Op.like] : clientOldValues.id_hitech
                        }
                    },
                    {
                        [Op.and] : [
                            { nom : clientOldValues.nom },
                            { prenom : clientOldValues.prenom },
                            { cp : clientOldValues.cp },
                            { tel1 : clientOldValues.tel1 }
                        ]
                    }
                ]  
            }
        })

        if(client === null) {
            const infosLog = await JSON.stringify(clientOldValues)
            throw `api/ajouteRDV - Le client n'existe pas : ** ${infosLog} **`
        }

        // mise à jour du client
        client.nom = isSet(data.clientUpdated.nom) ? data.clientUpdated.nom.toUpperCase() : null
        client.prenom = isSet(data.clientUpdated.prenom) ? data.clientUpdated.prenom.toUpperCase() : null
        client.tel1 = isSet(data.clientUpdated.tel1) ? formatPhone(data.clientUpdated.tel1) : null
        client.tel2 = isSet(data.clientUpdated.tel2) ? formatPhone(data.clientUpdated.tel2) : null
        client.tel3 = isSet(data.clientUpdated.tel3) ? formatPhone(data.clientUpdated.tel3) : null
        client.adresse = isSet(data.clientUpdated.adresse) ? data.clientUpdated.adresse.toUpperCase() : null
        client.cp = isSet(data.clientUpdated.cp) ? data.clientUpdated.cp : null
        client.dep = isSet(data.clientUpdated.cp) ? data.clientUpdated.cp.toString().substr(0,2) : null
        client.ville = isSet(data.clientUpdated.ville) ? data.clientUpdated.ville.toUpperCase() : null
        client.relation = isSet(data.clientUpdated.situafam) ? data.clientUpdated.situafam.toUpperCase() : null
        client.pro1 = isSet(data.clientUpdated.situapro) ? data.clientUpdated.situapro.toUpperCase() : null 
        client.pdetail1 = isSet(data.clientUpdated.situapro_pres) ? data.clientUpdated.situapro_pres.toUpperCase() : null
        client.age1 = isSet(data.clientUpdated.age) ? parseInt(data.clientUpdated.age) : null
        client.pro2 = isSet(data.clientUpdated.situapro2) ? data.clientUpdated.situapro2.toUpperCase() : null
        client.pdetail2 = isSet(data.clientUpdated.situapro2_pres) ? data.clientUpdated.situapro2_pres.toUpperCase() : null
        client.fioul = isSet(data.clientUpdated.x_qualif_fioul) ? (data.clientUpdated.x_qualif_fioul === 'True' ? 1 : 0) : null
        client.gaz = isSet(data.clientUpdated.x_qualif_gaz) ? (data.clientUpdated.x_qualif_gaz === 'True' ? 1 : 0) : null
        client.elec = isSet(data.clientUpdated.x_qualif_elec) ? (data.clientUpdated.x_qualif_elec === 'True' ? 1 : 0) : null
        client.bois = isSet(data.clientUpdated.x_qualif_bois) ? (data.clientUpdated.x_qualif_bois === 'True' ? 1 : 0) : null
        client.pac = isSet(data.clientUpdated.x_qualif_pac) ? (data.clientUpdated.x_qualif_pac === 'True' ? 1 : 0) : null
        client.autre = isSet(data.clientUpdated.x_qualif_autre) ? (data.clientUpdated.x_qualif_autre === 'True' ? 1 : 0) : null
        client.fchauffage = isSet(data.clientUpdated.montant_facture) ? data.clientUpdated.montant_facture : null
        client.surface = isSet(data.clientUpdated.sup) ? data.clientUpdated.sup : null
        client.panneaux = isSet(data.clientUpdated.x_qualif_panneaux) ? (data.clientUpdated.x_qualif_panneaux === 'True' ? 1 : 0) : null
        client.annee = isSet(data.clientUpdated.pv) ? data.clientUpdated.pv : null
        client.be = isSet(data.clientUpdated.bilan) ? (data.clientUpdated.bilan === 'True' ? 1 : 0) : null
        client.commentaire = isSet(data.clientUpdated.commentaire) ? data.clientUpdated.commentaire : null
        client.source = isSet(data.clientUpdated.source) ? data.clientUpdated.source : null
        client.type = isSet(data.clientUpdated.x_type_campagne) ? data.clientUpdated.x_type_campagne : null
        
        client.save()

        // création du rdv et de l'historique
        const historique = await models.Historique.create({
            idAction : 1,
            dateevent : moment(data.rdv.daterdv),
            commentaire : isSet(data.rdv.cr) ? data.rdv.cr.obsvente : null,
            idClient : client.id,
            // idUser : tabUser[data.rdv.telepro],
            idUser : await getIdTeleproByPrenom(data.rdv.telepro),
            createdAt : moment(data.rdv.dateappel)
        })

        // ajout de l'historique au client
        client.update({
            currentAction : historique.idAction,
            currentUser : historique.idUser
        })

        const rdv = await models.RDV.create({
            idClient : client.id,
            idHisto : historique.id,
            idVendeur : await getIdVendeur(data.rdv.referen),
            source : data.rdv.origine,
            statut : listeStatutRDV[data.rdv.etat] !== undefined ? listeStatutRDV[data.rdv.etat] : listeStatutRDV['Non Confirmé'],
            // TODO: gérer les états
            // idEtat : tabEtat[data.rdv.etat] !== undefined ? tabEtat[data.rdv.etat] : '15',
            commentaire : isSet(data.rdv.cr) ? data.rdv.cr.obsvente : null,
            date : moment(data.rdv.daterdv)
        })

        historique.update({
            idRdv : rdv.id
        })
    }
    catch(error) {
        console.error(error)
    }
    finally {
        res.end()
    }
})
// confirme un rdv depuis ezqual
.patch('/confirmeRDV', async (req, res) => {
    const data = req.body

    try {
        const temp_client = {
            id_hitech : isSet(data.id_hitech) ? data.id_hitech : null,
            nom : isSet(data.nom) ? data.nom.toUpperCase() : null,
            prenom : isSet(data.prenom) ? data.prenom.toUpperCase() : null,
            tel1 : isSet(data.tel1) ? formatPhone(data.tel1) : null,
            cp : isSet(data.cp) ? data.cp : null
        }
        // TODO: voir s'il y a autre chose qu'il faut mettre à jour en plus du rdv pour que celui-ci soit confirmé
        const client = await models.Client.findOne({
            where : {
                [Op.or] : [
                    { 
                        id_hitech : {
                            [Op.like] : temp_client.id_hitech
                        }
                    },
                    {
                        [Op.and] : [
                            { nom : temp_client.nom },
                            { prenom : temp_client.prenom },
                            { cp : temp_client.cp },
                            { tel1 : temp_client.tel1 }
                        ]
                    }
                ]  
            }
        })

        if(client === null) {
            const infosLog = await JSON.stringify(temp_client)
            throw `api/confirmeRDV - Le client n'existe pas : ** ${infosLog} **`
        }

        const temp_rdv = {
            idClient : client.id,
            source : data.origine,
            statut : listeStatutRDV[data.etat] !== undefined ? listeStatutRDV[data.etat] : listeStatutRDV['Non Confirmé'],
            // TODO: voir pour chercher avec état également?
            // statut : tabEtat[data.etat] !== undefined ? tabEtat[data.etat] : null,
            date : moment(data.daterdv)
        }

        console.log(JSON.stringify(temp_rdv))

        const rdv = await models.RDV.findOne({
            where : temp_rdv
        })

        if(rdv === null) {
            const infosLog = await JSON.stringify(data)
            throw `api/confirmeRDV - Le RDV n'existe pas : ** ${infosLog} **`
        }

        rdv.statut = listeStatutRDV['Confirmé']
        rdv.save()
    }
    catch(error) {
        console.error(error)
    }
    finally {
        res.end()
    }
})
// ajoute le rapport à un rdv depuis ezqual
.patch('/ajoutRapport', async (req, res) => {

})


router.get('/:Id' ,(req, res, next) => {
    
    let currentres = res;

    res.status(200)

    request('http://ezqual.fr/clientstofuego.php?id='+req.params.Id, { json: true }, (err, res, body) => {
        // request('http://localhost/ezqual/clientstofuego.php?id='+req.params.Id, { json: true }, (err, res, body) => {
        if (err) { return console.log(err); }
        body = JSON.parse(JSON.stringify(body).replace(/\:null/gi, "\:\"\""));
        
        if(body != 'ok'){

        if(typeof body.rdv == 'undefined' || (Object.entries(body.rdv).length === 0)){
            body.fioul = body.x_qualif_fioul == 'TRUE' ? 1 : 0;
            body.gaz = body.x_qualif_gaz == 'TRUE' ? 1 : 0,
            body.elec = body.x_qualif_elec == 'TRUE' ? 1 : 0,
            body.bois = body.x_qualif_bois == 'TRUE' ? 1 : 0,
            body.pac = body.x_qualif_pac == 'TRUE' ? 1 : 0,
            body.autre = body.x_qualif_autre == 'TRUE' ? 1 : 0,
            body.panneaux = body.x_qualif_panneaux == 'TRUE' ? 1 : 0,
            body.commentaire = ''
        }else{
            body.fioul = body.x_qualif_fioul == 'TRUE' || body.rdv[0].installation == 'Fioul' || body.rdv[0].installation2 == 'Fioul' || body.rdv[0].installation3 == 'Fioul' ? 1 : 0,
            body.gaz = body.x_qualif_gaz == 'TRUE' || body.rdv[0].installation == 'Gaz' || body.rdv[0].installation2 == 'Gaz' || body.rdv[0].installation3 == 'Gaz' ? 1 : 0,
            body.elec = body.x_qualif_elec == 'TRUE' || body.rdv[0].installation == 'Elec' || body.rdv[0].installation2 == 'Elec' || body.rdv[0].installation3 == 'Elec' ? 1 : 0,
            body.bois = body.x_qualif_bois == 'TRUE' || body.rdv[0].installation == 'Bois' || body.rdv[0].installation2 == 'Bois' || body.rdv[0].installation3 == 'Bois' ? 1 : 0,
            body.pac = body.x_qualif_pac == 'TRUE' || body.rdv[0].installation == 'Pac' || body.rdv[0].installation2 == 'Pac' || body.rdv[0].installation3 == 'Pac'? 1 : 0,
            body.autre = body.x_qualif_autre == 'TRUE' || body.rdv[0].installation == 'Autre' || body.rdv[0].installation2 == 'Autre' || body.rdv[0].installation3 == 'Autre'? 1 : 0,
            body.panneaux = body.x_qualif_panneaux == 'TRUE' || body.rdv[0].installation == 'Solaire' || body.rdv[0].installation2 == 'Solaire' || body.rdv[0].installation3 == 'Solaire'? 1 : 0,
            body.commentaire = body.rdv[0].presclient
        }

        models.Client.findOne({
            where: {
                id_hitech: body.id_hitech
            }
        }).then((findedClient) => {

        if(!findedClient){
            models.Client.create({
            id_hitech: body.id_hitech,
            nom: typeof body.nom != 'undefined' ? body.nom.toUpperCase() : null,
            prenom: typeof body.prenom != 'undefined' ? body.prenom.toUpperCase() : null,
            tel1: typeof body.tel1 != 'undefined' ? formatPhone(body.tel1) : null,
            tel2: typeof body.tel2 != 'undefined' ? formatPhone(body.tel2) : null,
            tel3: typeof body.tel3 != 'undefined' ? formatPhone(body.tel3) : null,
            adresse: typeof body.adresse != 'undefined' ? body.adresse.toUpperCase() : null,
            cp: typeof body.cp != 'undefined' ? body.cp : null,
            dep: typeof body.cp != 'undefined' ? body.cp.toString().substr(0,2) : null,
            ville: typeof body.ville != 'undefined' ? body.ville.toUpperCase() : null,
            relation: typeof body.situafam != 'undefined' ? body.situafam.toUpperCase() : null,
            pro1: typeof body.situapro != 'undefined' ? body.situapro.toUpperCase() : null,
            pdetail1: typeof body.situapro_pres != 'undefined' ? body.situapro_pres.toUpperCase() : null,
            age1: typeof body.age != 'undefined' ? parseInt(body.age) : null,
            pro2: typeof body.situapro2 != 'undefined' ? body.situapro2.toUpperCase() : null,
            pdetail2: typeof body.situapro2_pres != 'undefined' ? body.situapro2_pres.toUpperCase() : null,
            age2: typeof body.age != 'undefined' ? parseInt(body.age) : null,
            fioul: typeof body.fioul != 'undefined' ? body.fioul : null,
            gaz: typeof body.gaz != 'undefined' ? body.gaz : null,
            elec: typeof body.elec != 'undefined' ? body.elec : null,
            bois: typeof body.bois != 'undefined' ? body.bois : null,
            pac: typeof body.pac != 'undefined' ? body.pac : null,
            autre: typeof body.autre != 'undefined' ? body.autre : null,
            fchauffage: typeof body.montant_facture != 'undefined' ? body.montant_facture : null,
            surface: typeof body.sup != 'undefined' ? body.sup : null,
            panneaux: typeof body.panneaux != 'undefined' ? body.panneaux : null,
            annee: typeof body.pv != 'undefined' ? body.pv == '' ? null : body.pv : null,
            be: typeof body.bilan != 'undefined' ? body.bilan == 'TRUE' ? 1 : 0 : null,
            commentaire: typeof body.commentaire != 'undefined' ? body.commentaire : null,
            source: typeof body.source != 'undefined' ? body.source : null,
            type: typeof body.x_type_campagne != 'undefined' ? body.x_type_campagne : null,
            }).then((result) => {
            if(body.appels.length != 0 ){
                body.appels.forEach((element) => {
                    models.Historique.create({
                        idAction: 2,
                        idClient: result.id,
                        idUser: tabStatClick[element.telepro], 
                        createdAt: moment(element.dateclick)
                    }).catch(function (e) {
                        console.log('error', e);
                    });;
                });
                    if(body.statut != 'RDV' &&  body.statut != 'A TRAITER'){
                        models.Historique.create({
                            idAction: tabStatut[body.statut],
                            idClient: result.id,
                            idUser: tabStatClick[body.idtelepro], 
                            createdAt: moment(body.datetraitement)
                        }).then((historique) => {
                            result.update({currentAction: historique.idAction, currentUser: historique.idUser})
                        }).catch(function (e) {
                            console.log('error', e);
                        });;
                    }
                    if(body.statut == 'RDV'){
                        if(body.rdv.length != 0 ){
                            body.rdv.forEach( (element) => {
                                models.Historique.create({
                                    idAction: 1,
                                    dateevent: element.daterdv,
                                    commentaire: element.cr.obsvente,  
                                    idClient: result.id,
                                    idUser: tabUser[element.telepro], 
                                    createdAt: element.daterdv
                                }).then((result2) => {
                                    result.update({currentAction: result2.idAction, currentUser: result2.idUser})
                                    models.RDV.create({
                                        idClient: result.id,
                                        idHisto: result2.id,
                                        source: 'TMK',
                                        idEtat: typeof tabEtat[element.etat] != 'undefined' ? tabEtat[element.etat] : '15',
                                        commentaire: element.cr.obsvente, 
                                        date: element.daterdv
                                    }).then((result3) => {
                                        result2.update({idRdv: result3.id}).catch(function (e) {
                                            console.log('error', e);
                                        });
                                    }).catch(function (e) {
                                        console.log('error', e);
                                    });
                                }).catch(function (e) {
                                    console.log('error', e);
                                });
                            });
                        }
                    }else{
                    }
            }else{
            }
            }).catch(function (e) {
            console.log('error', e);
            });
        }

        });
        }else{
        }
    });
});                

router.get('/cp/:cp' ,(req, res, next) => {
    
    let currentres = res;

    res.status(200)

    
    rp('http://ezqual.fr/getTabId.php?id='+req.params.cp, { json: true }, (err, res, body) => {
        if (err) { return console.log(err); }
        res = JSON.parse(JSON.stringify(res).replace(/\:null/gi, "\:\"\""));

        let i = 0;
        if(res != 'ok'){

            let promises = [];
            for (let i = 0; i <= res.body.length; i++) {
                promises.push(apicall(res.body[i]));
            }
            Promise.all(promises).then(() => {
                console.log(promises)
            }).catch(err => {
                console.log(err)
            });
        }else{
            console.log('---------------');
            console.log('test');
            console.log('---------------');
        }
    });
});

function apicall(element){
    if(typeof element != 'undefined'){
        return rp('http://fuego.ovh/api/'+element.id, { json: true }).then((obj) => {
            console.log(obj)
            return obj
        })
    }
}

router.post('/ezqual' ,(req, res, next) => {

    res.status(200)

    let body = req.body


    body.fioul = body.x_qualif_fioul == 'TRUE' ? 1 : 0
    body.gaz = body.x_qualif_gaz == 'TRUE' ? 1 : 0
    body.elec = body.x_qualif_elec == 'TRUE' ? 1 : 0
    body.bois = body.x_qualif_bois == 'TRUE' ? 1 : 0
    body.pac = body.x_qualif_pac == 'TRUE' ? 1 : 0
    body.autre = body.x_qualif_autre == 'TRUE' ? 1 : 0
    body.panneaux = body.x_qualif_panneaux == 'TRUE' ? 1 : 0

    models.Client.findOne({
        where: {
            id_hitech: body.id_hitech
        }
    }).then((findedClient) => {

        if(!findedClient){

        models.Client.create({
            id_hitech: body.id_hitech,
            nom: typeof body.nom != 'undefined' && body.nom != 'NULL' ? body.nom.toUpperCase() : null,
            prenom: typeof body.prenom != 'undefined' && body.prenom != 'NULL' ? body.prenom.toUpperCase() : null,
            tel1: typeof body.tel1 != 'undefined' && body.tel1 != 'NULL' ? formatPhone(body.tel1) : null,
            tel2: typeof body.tel2 != 'undefined' && body.tel2 != 'NULL' ? formatPhone(body.tel2) : null,
            tel3: typeof body.tel3 != 'undefined' && body.tel3 != 'NULL' ? formatPhone(body.tel3) : null,
            adresse: typeof body.adresse != 'undefined' && body.adresse != 'NULL' ? body.adresse.toUpperCase() : null,
            cp: typeof body.cp != 'undefined' && body.cp != 'NULL' ? body.cp : null,
            dep: typeof body.cp != 'undefined' && body.cp != 'NULL' ? body.cp.toString().substr(0,2) : null,
            ville: typeof body.ville != 'undefined' && body.ville != 'NULL' ? body.ville.toUpperCase() : null,
            relation: typeof body.situafam != 'undefined' && body.situafam != 'NULL' ? body.situafam.toUpperCase() : null,
            pro1: typeof body.situapro != 'undefined' && body.situapro != 'NULL' ? body.situapro.toUpperCase() : null,
            pdetail1: typeof body.situapro_pres != 'undefined' && body.situapro_pres != 'NULL' ? body.situapro_pres.toUpperCase() : null,
            age1: typeof body.age != 'undefined' && body.age != 'NULL' ? parseInt(body.age) : null,
            pro2: typeof body.situapro2 != 'undefined' && body.situapro2 != 'NULL' ? body.situapro2.toUpperCase() : null,
            pdetail2: typeof body.situapro2_pres != 'undefined' && body.situapro2_pres != 'NULL' ? body.situapro2_pres.toUpperCase() : null,
            age2: typeof body.age != 'undefined' && body.age != 'NULL' ? parseInt(body.age) : null,
            fioul: typeof body.fioul != 'undefined' && body.fioul != 'NULL' ? body.fioul : null,
            gaz: typeof body.gaz != 'undefined' && body.gaz != 'NULL' ? body.gaz : null,
            elec: typeof body.elec != 'undefined' && body.elec != 'NULL' ? body.elec : null,
            bois: typeof body.bois != 'undefined' && body.bois != 'NULL' ? body.bois : null,
            pac: typeof body.pac != 'undefined' && body.pac != 'NULL' ? body.pac : null,
            autre: typeof body.autre != 'undefined' && body.autre != 'NULL' ? body.autre : null,
            fchauffage: typeof body.montant_facture != 'undefined' && body.montant_facture != 'NULL' ? body.montant_facture : null,
            panneaux: typeof body.panneaux != 'undefined' && body.panneaux != 'NULL' ? body.panneaux : null,
            be: typeof body.bilan != 'undefined' && body.bilan != 'NULL' ? body.bilan == 'TRUE' ? 1 : 0 : null,
            commentaire: typeof body.commentaire != 'undefined' && body.commentaire != 'NULL' ? body.commentaire : null,
            source: typeof body.source != 'undefined' && body.source != 'NULL' ? body.source : null,
            type: typeof body.x_type_campagne != 'undefined' && body.x_type_campagne != 'NULL' ? body.x_type_campagne : null,
        }).then((result) => {
            models.Historique.create({
                idAction: 1,
                idClient: result.id,
                dateevent: moment(body.daterdv),
                commentaire: body.commentaire,  
                idUser: tabStatClick[body.idtelepro], 
                createdAt: moment(body.datetraitement)
            }).then((historique) => {
                result.update({currentAction: historique.idAction, currentUser: historique.idUser})
                models.RDV.create({
                    idClient: result.id,
                    idHisto: historique.id,
                    commentaire: body.commentaire,
                    date: moment(body.daterdv)
                }).then((result3) => {
                    historique.update({idRdv: result3.id}).catch(function (e) {
                        console.log('error', e);
                    });
                });
            }).catch(function (e) {
                console.log('error', e);
            });
    }).catch(function (e) {
        console.log('error', e);
    });
    } else {
        findedClient.update({
            id_hitech: body.id_hitech,
            nom: typeof body.nom != 'undefined' && body.nom != 'NULL' ? body.nom.toUpperCase() : null,
            prenom: typeof body.prenom != 'undefined' && body.prenom != 'NULL' ? body.prenom.toUpperCase() : null,
            tel1: typeof body.tel1 != 'undefined' && body.tel1 != 'NULL' ? formatPhone(body.tel1) : null,
            tel2: typeof body.tel2 != 'undefined' && body.tel2 != 'NULL' ? formatPhone(body.tel2) : null,
            tel3: typeof body.tel3 != 'undefined' && body.tel3 != 'NULL' ? formatPhone(body.tel3) : null,
            adresse: typeof body.adresse != 'undefined' && body.adresse != 'NULL' ? body.adresse.toUpperCase() : null,
            cp: typeof body.cp != 'undefined' && body.cp != 'NULL' ? body.cp : null,
            dep: typeof body.cp != 'undefined' && body.cp != 'NULL' ? body.cp.toString().substr(0,2) : null,
            ville: typeof body.ville != 'undefined' && body.ville != 'NULL' ? body.ville.toUpperCase() : null,
            relation: typeof body.situafam != 'undefined' && body.situafam != 'NULL' ? body.situafam.toUpperCase() : null,
            pro1: typeof body.situapro != 'undefined' && body.situapro != 'NULL' ? body.situapro.toUpperCase() : null,
            pdetail1: typeof body.situapro_pres != 'undefined' && body.situapro_pres != 'NULL' ? body.situapro_pres.toUpperCase() : null,
            age1: typeof body.age != 'undefined' && body.age != 'NULL' ? parseInt(body.age) : null,
            pro2: typeof body.situapro2 != 'undefined' && body.situapro2 != 'NULL' ? body.situapro2.toUpperCase() : null,
            pdetail2: typeof body.situapro2_pres != 'undefined' && body.situapro2_pres != 'NULL' ? body.situapro2_pres.toUpperCase() : null,
            age2: typeof body.age != 'undefined' && body.age != 'NULL' ? parseInt(body.age) : null,
            fioul: typeof body.fioul != 'undefined' && body.fioul != 'NULL' ? body.fioul : null,
            gaz: typeof body.gaz != 'undefined' && body.gaz != 'NULL' ? body.gaz : null,
            elec: typeof body.elec != 'undefined' && body.elec != 'NULL' ? body.elec : null,
            bois: typeof body.bois != 'undefined' && body.bois != 'NULL' ? body.bois : null,
            pac: typeof body.pac != 'undefined' && body.pac != 'NULL' ? body.pac : null,
            autre: typeof body.autre != 'undefined' && body.autre != 'NULL' ? body.autre : null,
            fchauffage: typeof body.montant_facture != 'undefined' && body.montant_facture != 'NULL' ? body.montant_facture : null,
            panneaux: typeof body.panneaux != 'undefined' && body.panneaux != 'NULL' ? body.panneaux : null,
            be: typeof body.bilan != 'undefined' && body.bilan != 'NULL' ? body.bilan == 'TRUE' ? 1 : 0 : null,
            commentaire: typeof body.commentaire != 'undefined' && body.commentaire != 'NULL' ? body.commentaire : null,
            source: typeof body.source != 'undefined' && body.source != 'NULL' ? body.source : null,
            type: typeof body.x_type_campagne != 'undefined' && body.x_type_campagne != 'NULL' ? body.x_type_campagne : null,
        }).then((result) => {
            models.Historique.create({
                idAction: 1,
                idClient: result.id,
                dateevent: moment(body.daterdv),
                commentaire: body.commentaire,  
                idUser: tabStatClick[body.idtelepro], 
                createdAt: moment(body.datetraitement)
            }).then((historique) => {
                result.update({currentAction: historique.idAction, currentUser: historique.idUser})
                models.RDV.create({
                    idClient: result.id,
                    idHisto: historique.id,
                    commentaire: body.commentaire,
                    date: moment(body.daterdv)
                }).then((result3) => {
                    historique.update({idRdv: result3.id}).catch(function (e) {
                        console.log('error', e);
                    });
                });
            }).catch(function (e) {
                console.log('error', e);
            });
    }).catch(function (e) {
        console.log('error', e);
    });
    }
    res.send('ok200')
    })
});                


module.exports = router;

function formatPhone(phoneNumber){

    if(phoneNumber != null && typeof phoneNumber != 'undefined' && phoneNumber != ' '){
        phoneNumber = cleanit(phoneNumber);
	    phoneNumber = phoneNumber.split(' ').join('')
        phoneNumber = phoneNumber.split('.').join('')

        if(phoneNumber.length != 10){

            phoneNumber = '0'+phoneNumber;

            if(phoneNumber.length != 10){
                return undefined
            }else{
                return phoneNumber
            }
        }else{
            return phoneNumber
        }
    }

}
function cleanit(input) {
    input.toString().trim().split('/\s*\([^)]*\)/').join('').split('/[^a-zA-Z0-9]/s').join('')
	return input.toString().toLowerCase()
}
let tabStatut = {
    'REFUS': '16',
    'LISTE NOIRE': '3',
    'ERREUR COORDONNEES': '4',
    'HORS CRITERE': '5',
    'RTVE STE': '6',
    'ERREUR PANNEAUX': '7',
    'RAPPEL': '8',
    'N° NON ATTRIBUE': '9',
    'HS': '10',
    'NRP': '11',
    'STE TJRS ACTIVE': '12',
    'AUTRE': '13',
    'LITIGE': '14',
    'LISTE ROUGE': '3'
}
let tabUser = {
    'catherine': '2',
    'sebastien': '16',
    'johan': '1',
    'super': '4',
    'Angeline': '5',
    'Wissame': '6',
    'Stephanie': '7',
    'Nassim': '8',
    'Anais': '9',
    'damien': '10',
    'Marietherese': '11',
    'Sybille': '12',
    'Lucas': '13',
    'Oceane': '14',
    'Alexane': '15',
    'Enzo': '49'
}
let tabStatClick = {
    'catherine@qualicom-conseil.fr': '2',
    'sebastien@qualicom-conseil.fr': '16',
    'johan@qualicom-conseil.fr': '1',
    'super@qualicom-conseil.fr': '4',
    'angeline@qualicom-conseil.fr': '5',
    'wissame@qualicom-conseil.fr': '6',
    'stephanie@qualicom-conseil.fr': '7',
    'nassim@qualicom-conseil.fr': '8',
    'anais@qualicom-conseil.fr': '9',
    'damien@qualicom-conseil.fr': '10',
    'marietherese@qualicom-conseil.fr': '11',
    'sybille@qualicom-conseil.fr': '12',
    'lucas@qualicom-conseil.fr': '13',
    'oceane@qualicom-conseil.fr': '14',
    'alexane@qualicom-conseil.fr': '15',
    'enzo@qualicom-conseil.fr': '49'
}
let tabEtat = {
    'ABS': '7',
    'ANNULE': '6',
    'ANNULE AU REPORT': '6',
    'Confirmé': '5',
    'DECOUVERTE': '8',
    'DEEM': '3',
    'DEM': '3',
    'En cours': '4',
    'HC': '14',
    'PAS eTe': '10',
    'REFUS': '11',
    'REFUS DEM': '11',
    'REPOSITIONNE': '13',
    'repo_client': '13',
    'repo_com': '12',
    'Valide(ABS)': '7',
    'Valide(ANNULE)': '6',
    'Valide(DECOUVERTE)': '8',
    'Valide(DEM R.A.F.)': '3',
    'Valide(DEM SUIVI)': '2',
    'Valide(DEVIS)': '9',
    'Valide(PAS ETE)': '10',
    'Valide(REFUS DEM)': '11',
    'Valide(VENTE ADD)': '1'
}

const listeStatutRDV = {
    'Confirmé' : 1,
    'Non Confirmé' : 0,
    'A repositionner' : 3
}