const express = require('express');
const router = express.Router();
const request = require('request');
const models = global.db;
const { Op } = require("sequelize");
const moment = require('moment');
const rp = require('request-promise');
const axios = require('axios').default
const clientInformationObject = require('../utils/errorHandler')

const FORMAT_DATE = 'YYYY-MM-DD'
const API_EZQUAL = 'http://ezqual.fr'
// const API_EZQUAL = 'http://localhost/ezqual'

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
                url : `${API_EZQUAL}/api/getVendeurs.php`,
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
                url : `${API_EZQUAL}/api/getTelepros.php`,
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
    const user = await models.User.findOne({
        where : search
    })

    return isSet(user) ? user.id : null
}

async function getIdTeleproByPrenom(prenom) {
    const listeTelepros = await getListeTelepros()

    const telepro = listeTelepros.filter(telepro => {
        const reg = new RegExp(prenom, 'ig')
        return !!telepro.prenom.match(reg)
    })[0]
    
    // si on ne retrouve pas, l'id de Wissam est passé
    if(telepro === undefined) return 6
    
    return await getIdUser({
        /*les nom entre ezqual et fuego ne correspondent pas toujours pour les telepros
        nom : telepro.nom,*/
        prenom : models.sequelize.where(models.sequelize.fn('LOWER', models.sequelize.col('prenom')), 'LIKE', `%${telepro.prenom.toLowerCase()}%`),
        mail : telepro.mail
    })
}

async function getIdTeleproByEmail(mail) {
    if(!isSet(mail)) return null
    
    return await getIdUser({
        mail : mail
    })
}

async function getIdVendeur(mail) {
    if(!isSet(mail)) return null
    
    const listeVendeurs = await getListeVendeurs()

    const vendeur = listeVendeurs.filter(vendeur => {
        const reg = new RegExp(mail, 'ig')
        return !!vendeur.mail.match(reg)
    })[0]

    // si on ne retrouve pas
    if(vendeur === undefined) return null

    // recherche uniquement par nom prenom
    return await getIdUser({
        // prenom : vendeur.prenom,
        // nom : vendeur.nom
        prenom : models.sequelize.where(models.sequelize.fn('LOWER', models.sequelize.col('prenom')), 'LIKE', `%${vendeur.prenom.toLowerCase()}%`),
        nom : models.sequelize.where(models.sequelize.fn('LOWER', models.sequelize.col('nom')), 'LIKE', `%${vendeur.nom.toLowerCase()}%`),
    })
}

const tabCorrespondanceInstallationClient = {
    'Bois' : 'poele',
    'Fioul' : 'fioul',
    'Gaz' : 'gaz',
    'Elec' : 'elec',
    'Pac' : 'pacAA',
    'Solaire' : 'autre',
    'Centrale solaire' : 'autre',
    'Autre' : 'autre'
}

async function setInstallationClient(client, infosRdv) {
    // initialisation des valeurs
    client.poele = 0
    client.fioul = 0
    client.gaz = 0
    client.elec = 0
    client.pacAA = 0
    client.autre = 0
    client.panneaux = 0

    if(isSet(infosRdv.installation)) {
        client[tabCorrespondanceInstallationClient[infosRdv.installation]] = 1
    } 
    if(isSet(infosRdv.installation2)) {
        client[tabCorrespondanceInstallationClient[infosRdv.installation2]] = 1
    }
    if(isSet(infosRdv.installation3)) {
        client[tabCorrespondanceInstallationClient[infosRdv.installation3]] = 1
    } 
    if(isSet(infosRdv.nb_panneaux) && infosRdv.nb_panneaux > 0) {
        client.panneaux = 1
    }
}

function isSet(val) {
    if(typeof val === 'string') {
        val = val.trim()
    }

    if(val === '' || val === undefined || val === 'undefined' || val === null || val === 'NULL' || val.length === 0) {
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
.post('/ajouteClient/:idClientEzqual', async (req, res) => {
    let infos = undefined
    const paramIdClientEzqual = req.params.idClientEzqual

    try {
        if(!isSet(paramIdClientEzqual)) {
            throw "L'identifiant du client n'a pas été fourni à FUEGO."
        }

        const response = await axios({
            method : 'GET',
            url : `${API_EZQUAL}/clientstofuego.php?id=${paramIdClientEzqual}`,
            responseType : 'json'
        })

        const data = response.data

        // traitement du cp pour récupérer le zéro initial lorsq'il y en a un, perdu par le json_encode de php
        data.cp = isSet(data.cp) ? (data.cp.toString().length < 5 ? `0${data.cp}` : data.cp) : null

        const temp_client = {
            id_hitech : isSet(data.id_hitech) ? data.id_hitech : null,
            nom : isSet(data.nom) ? data.nom.toString().toUpperCase().trim() : null,
            prenom : isSet(data.prenom) ? data.prenom.toString().toUpperCase().trim() : null,
            tel1 : isSet(data.tel1) ? formatPhone(data.tel1) : null,
            tel2 : isSet(data.tel2) ? formatPhone(data.tel2) : null,
            tel3 : isSet(data.tel3) ? formatPhone(data.tel3) : null,
            adresse : isSet(data.adresse) ? data.adresse.toString().toUpperCase().trim() : null,
            cp : isSet(data.cp) ? data.cp : null,
            dep : isSet(data.cp) ? data.cp.toString().substr(0,2) : null,
            ville : isSet(data.ville) ? data.ville.toString().toUpperCase().trim() : null,
            relation : isSet(data.situafam) ? data.situafam.toString().toUpperCase().trim() : null,
            pro1 : isSet(data.situapro) ? data.situapro.toString().toUpperCase().trim() : null, 
            pdetail1 : isSet(data.situapro_pres) ? data.situapro_pres.toString().toUpperCase().trim() : null,
            age1 : isSet(data.age) ? parseInt(data.age) : null,
            pro2 : isSet(data.situapro2) ? data.situapro2.toString().toUpperCase().trim() : null,
            pdetail2 : isSet(data.situapro2_pres) ? data.situapro2_pres.toString().toUpperCase().trim() : null,
            source : isSet(data.source) ? data.source : null,
            type : isSet(data.x_type_campagne) ? data.x_type_campagne : null,
            mail : isSet(data.mail) ? data.mail : null
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
            if(isSet(data.rdv)) {
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
                    client.currentAction = historique.idAction
                    client.currentUser = historique.idUser
                    client.commentaire = isSet(rdv.presclient) ? rdv.presclient : null
                    // ajout des infos sur son installation
                    setInstallationClient(client, rdv)
                    await client.save()

                    const createdRDV = await models.RDV.create({
                        idClient : client.id,
                        idHisto : historique.id,
                        idVendeur : await getIdVendeur(rdv.referen),
                        source : rdv.origine,
                        statut : tabEtat[rdv.etat] !== undefined ? tabEtat[rdv.etat] : tabEtat['Non Confirmé'],
                        idEtat : isSet(rdv.cr) ? ((isSet(rdv.cr.qualiter) && tabEtat[rdv.cr.qualiter] !== undefined) ? tabEtat[rdv.cr.qualiter] : '15') : null,
                        r : isSet(rdv.r) ? rdv.r.slice(1) : null,
                        commentaire : isSet(rdv.cr) ? rdv.cr.obsvente : null,
                        date : moment(rdv.daterdv)
                    })

                    await historique.update({
                        idRdv : createdRDV.id
                    })
                }
            }

            if(data.statut !== 'RDV' && data.statut !== 'A TRAITER') {
                const historique = await models.Historique.create({
                    idAction : tabStatut[data.statut],
                    idClient : client.id,
                    // idUser : tabStatClick[data.idtelepro],
                    idUser : await getIdTeleproByEmail(data.idtelepro),
                    createdAt : moment(data.datetraitement)
                })

                await client.update({
                    currentAction : historique.idAction,
                    currentUser : historique.idUser
                })
            }

            infos = clientInformationObject(undefined, "Le client a bien été ajouté à FUEGO.")
        }
        // si nouveau rdv pour client connu, ajouter seulement son dernier rdv s'il n'existe pas déjà
        else {
            console.log(`Client déjà existant : id_hitech(${client.id_hitech}), nom(${client.nom}), prenom(${client.prenom}), cp(${client.cp}), tel1(${client.tel1})`)
            if(isSet(data.rdv)) {
                const rdv = data.rdv[data.rdv.length - 1]
                
                // teste s'il n'existe pas encore de rdv
                if(rdv !== undefined) {
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
                        client.currentAction = historique.idAction
                        client.currentUser = historique.idUser
                        commentaire = isSet(rdv.presclient) ? rdv.presclient : null
                        // ajout des infos sur son installation
                        setInstallationClient(client, rdv)
                        await client.save()

                        const temp_rdv = {
                            idClient : client.id,
                            idHisto : historique.id,
                            idVendeur : await getIdVendeur(rdv.referen),
                            source : rdv.origine,
                            // statut : tabEtat[rdv.etat] !== undefined ? tabEtat[rdv.etat] : tabEtat['Non Confirmé'],
                            // idEtat : isSet(rdv.cr) ? ((isSet(rdv.cr.qualiter) && tabEtat[rdv.cr.qualiter] !== undefined) ? tabEtat[rdv.cr.qualiter] : '15') : null,
                            r : isSet(rdv.r) ? rdv.r.slice(1) : null,                        
                            date : moment(rdv.daterdv)
                        }
                        // s'il y a un compte rendu etat correspond à idEtat
                        if(isSet(rdv.cr)) {
                            temp_rdv.idEtat = tabEtat[rdv.etat] !== undefined ? tabEtat[rdv.etat] : tabEtat['NON RETROUVE']
                            temp_rdv.commentaire = isSet(rdv.cr.obsvente) ? rdv.cr.obsvente : null
                            // s'il y a eu des actions, on considère que le rdv était confirmé
                            temp_rdv.statut = tabEtat['Confirmé']
                        }
                        // sinon etat correspond au statut
                        else {
                            temp_rdv.statut = tabEtat[rdv.etat] !== undefined ? tabEtat[rdv.etat] : tabEtat['Non Confirmé']
                        }

                        const createdRDV = await models.RDV.create({ temp_rdv })

                        await historique.update({
                            idRdv : createdRDV.id
                        })

                        infos = clientInformationObject(undefined, "Le client était déjà présent dans FUEGO mais de nouvelles informations lui ont été ajoutées.")
                    }
                    else {
                        infos = clientInformationObject(undefined, "Le client était déjà présent dans FUEGO.")
                    }
                }
            }
            else {
                infos = clientInformationObject(undefined, "Le client était déjà présent dans FUEGO.")
            }
        }

        const tabPromisesAppels = []
        if(isSet(data.appels)) {
            for(const appel of data.appels) {
                // valeurs de l'appel
                const temp_appel = {
                    idAction : 2,
                    idClient : client.id,
                    // idUser : tabStatClick[appel.telepro],
                    idUser : await getIdTeleproByEmail(appel.telepro),
                    createdAt : moment(appel.dateclick)
                }

                // création uniquement des nouveaux appels
                tabPromisesAppels.push(models.Historique.findCreateFind({
                    where : temp_appel,
                    defaults : temp_appel
                }))
            }
            await Promise.all(tabPromisesAppels)
        }
    }
    catch(error) {
        infos = clientInformationObject(error)
    }
    
    res.send({ infos })
})
.patch('/modifieClient', async (req, res) => {
    let infos = undefined
    const data = req.body

    try {
        const clientOldValues = {
            id_hitech : isSet(data.client_old.id_hitech) ? data.client_old.id_hitech : null,
            nom : isSet(data.client_old.nom) ? data.client_old.nom.toString().toUpperCase().trim() : null,
            prenom : isSet(data.client_old.prenom) ? data.client_old.prenom.toString().toUpperCase().trim() : null,
            tel1 : isSet(data.client_old.tel1) ? formatPhone(data.client_old.tel1) : null,
            cp : isSet(data.client_old.cp) ? data.client_old.cp : null
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
            throw `FUEGO api/modifieClient - Le client n'existe pas : ** ${infosLog} **`
        }

        
        client.nom = isSet(data.client_new.nom) ? data.client_new.nom.toString().toUpperCase().trim() : null
        client.prenom = isSet(data.client_new.prenom) ? data.client_new.prenom.toString().toUpperCase().trim() : null
        client.tel1 = isSet(data.client_new.tel1) ? formatPhone(data.client_new.tel1) : null
        client.tel2 = isSet(data.client_new.tel2) ? formatPhone(data.client_new.tel2) : null
        client.tel3 = isSet(data.client_new.tel3) ? formatPhone(data.client_new.tel3) : null
        client.adresse = isSet(data.client_new.adresse) ? data.client_new.adresse.toString().toUpperCase().trim() : null
        client.cp = isSet(data.client_new.cp) ? data.client_new.cp : null
        client.dep = isSet(data.client_new.cp) ? data.client_new.cp.toString().substr(0,2) : null
        client.ville = isSet(data.client_new.ville) ? data.client_new.ville.toString().toUpperCase().trim() : null
        client.relation = isSet(data.client_new.situafam) ? data.client_new.situafam.toString().toUpperCase().trim() : null
        client.pro1 = isSet(data.client_new.situapro) ? data.client_new.situapro.toString().toUpperCase().trim() : null 
        client.pdetail1 = isSet(data.client_new.situapro_pres) ? data.client_new.situapro_pres.toString().toUpperCase().trim() : null
        client.age1 = isSet(data.client_new.age) ? parseInt(data.client_new.age) : null
        client.pro2 = isSet(data.client_new.situapro2) ? data.client_new.situapro2.toString().toUpperCase().trim() : null
        client.pdetail2 = isSet(data.client_new.situapro2_pres) ? data.client_new.situapro2_pres.toString().toUpperCase().trim() : null
        client.source = isSet(data.client_new.source) ? data.client_new.source : null
        client.type = isSet(data.client_new.x_type_campagne) ? data.client_new.x_type_campagne : null
        client.mail = isSet(data.client_new.mail) ? data.client_new.mail : null

        await client.save()

        infos = clientInformationObject(undefined, "Le client a bien été modifié dans FUEGO.")
    }
    catch(error) {
        infos = clientInformationObject(error)
    }
    
    res.send({ infos })
})
// ajoute rdv et update client
.post('/ajouteRDV', async (req, res) => {
    let infos = undefined
    const data = req.body
    
    try {
        const clientOldValues = {
            id_hitech : isSet(data.clientOld.id_hitech) ? data.clientOld.id_hitech : null,
            nom : isSet(data.clientOld.nom) ? data.clientOld.nom.toString().toUpperCase().trim() : null,
            prenom : isSet(data.clientOld.prenom) ? data.clientOld.prenom.toString().toUpperCase().trim() : null,
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
            throw `FUEGO api/ajouteRDV - Le client n'existe pas : ** ${infosLog} **`
        }

        // lors d'un report de rdv, le client n'est pas modifié
        // on passe donc toutes les infos clients dans une seule variable pour les deux, d'où la recopie de la variable clientOld
        if(!isSet(data.clientUpdated)) {
            data.clientUpdated = data.clientOld
        }

        // mise à jour du client
        client.nom = isSet(data.clientUpdated.nom) ? data.clientUpdated.nom.toString().toUpperCase().trim() : null
        client.prenom = isSet(data.clientUpdated.prenom) ? data.clientUpdated.prenom.toString().toUpperCase().trim() : null
        client.tel1 = isSet(data.clientUpdated.tel1) ? formatPhone(data.clientUpdated.tel1) : null
        client.tel2 = isSet(data.clientUpdated.tel2) ? formatPhone(data.clientUpdated.tel2) : null
        client.tel3 = isSet(data.clientUpdated.tel3) ? formatPhone(data.clientUpdated.tel3) : null
        client.adresse = isSet(data.clientUpdated.adresse) ? data.clientUpdated.adresse.toString().toUpperCase().trim() : null
        client.cp = isSet(data.clientUpdated.cp) ? data.clientUpdated.cp : null
        client.dep = isSet(data.clientUpdated.cp) ? data.clientUpdated.cp.toString().substr(0,2) : null
        client.ville = isSet(data.clientUpdated.ville) ? data.clientUpdated.ville.toString().toUpperCase().trim() : null
        client.relation = isSet(data.clientUpdated.situafam) ? data.clientUpdated.situafam.toString().toUpperCase().trim() : null
        client.pro1 = isSet(data.clientUpdated.situapro) ? data.clientUpdated.situapro.toString().toUpperCase().trim() : null 
        client.pdetail1 = isSet(data.clientUpdated.situapro_pres) ? data.clientUpdated.situapro_pres.toString().toUpperCase().trim() : null
        client.age1 = isSet(data.clientUpdated.age) ? parseInt(data.clientUpdated.age) : null
        client.pro2 = isSet(data.clientUpdated.situapro2) ? data.clientUpdated.situapro2.toString().toUpperCase().trim() : null
        client.pdetail2 = isSet(data.clientUpdated.situapro2_pres) ? data.clientUpdated.situapro2_pres.toString().toUpperCase().trim() : null
        client.source = isSet(data.clientUpdated.source) ? data.clientUpdated.source : null
        client.type = isSet(data.clientUpdated.x_type_campagne) ? data.clientUpdated.x_type_campagne : null
        commentaire = isSet(data.rdv.presclient) ? data.rdv.presclient : null
        // ajout des infos sur son installation
        setInstallationClient(client, data.rdv)

        await client.save()

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
        await client.update({
            currentAction : historique.idAction,
            currentUser : historique.idUser,
            commentaire : isSet(data.rdv.presclient) ? data.rdv.presclient : null
        })

        const rdv = await models.RDV.create({
            idClient : client.id,
            idHisto : historique.id,
            idVendeur : await getIdVendeur(data.rdv.referen),
            source : data.rdv.origine,
            statut : tabEtat[data.rdv.etat] !== undefined ? tabEtat[data.rdv.etat] : tabEtat['Non Confirmé'],
            // idEtat : isSet(data.rdv.cr) ? ((isSet(data.rdv.cr.qualiter) && tabEtat[data.rdv.cr.qualiter] !== undefined) ? tabEtat[data.rdv.cr.qualiter] : '15') : null,
            r : isSet(data.rdv.r) ? data.rdv.r.slice(1) : null,
            commentaire : isSet(data.rdv.cr) ? data.rdv.cr.obsvente : null,
            date : moment(data.rdv.daterdv),
            prisavec : data.rdv.prisavec
        })

        await historique.update({
            idRdv : rdv.id
        })

        infos = clientInformationObject(undefined, "Le RDV a bien été ajouté dans FUEGO.")
    }
    catch(error) {
        infos = clientInformationObject(error)
    }
    
    res.send({ infos })
})
// confirme un rdv depuis ezqual
.patch('/confirmeRDV', async (req, res) => {
    let infos = undefined
    const data = req.body

    try {
        const temp_client = {
            id_hitech : isSet(data.id_hitech) ? data.id_hitech : null,
            nom : isSet(data.nom) ? data.nom.toString().toUpperCase().trim() : null,
            prenom : isSet(data.prenom) ? data.prenom.toString().toUpperCase().trim() : null,
            tel1 : isSet(data.tel1) ? formatPhone(data.tel1) : null,
            cp : isSet(data.cp) ? data.cp : null
        }
        
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
            throw `FUEGO api/confirmeRDV - Le client n'existe pas : ** ${infosLog} **`
        }

        const temp_rdv = {
            idClient : client.id,
            source : data.origine,
            date : moment(data.daterdv)
        }
        // test pour savoir si la recherche doit se faire sur le statut ou sur l'état selon ce qui est défini
        // statut
        if(tabEtat[data.etat] <= 3) {
            temp_rdv.statut = tabEtat[data.etat]
        }
        // état
        else {
            temp_rdv.idEtat = tabEtat[data.etat]
        }

        const rdv = await models.RDV.findOne({
            where : temp_rdv
        })

        if(rdv === null) {
            const infosLog = await JSON.stringify(data)
            throw `FUEGO api/confirmeRDV - Le RDV n'existe pas : ** ${infosLog} **`
        }

        rdv.statut = tabEtat['Confirmé']
        await rdv.save()

        infos = clientInformationObject(undefined, 'Le RDV a bien été confirmé dans FUEGO.')
    }
    catch(error) {
        infos = clientInformationObject(error)
    }
    
    res.send({ infos })
})
// affecte un vendeur à un rdv
.patch('/affecteVendeurRDV', async (req, res) => {
    let infos = undefined
    const data = req.body
    // {"id_hitech":"q_77666","nom":"PERADOTTO","prenom":"Claudette et Jean","tel1":"0384449147","cp":"39210","origine":"TMK","etat":"En cours","daterdv":"2020-06-19 17:00:00","referen":"samir"}

    try {
        const temp_client = {
            id_hitech : isSet(data.id_hitech) ? data.id_hitech : null,
            nom : isSet(data.nom) ? data.nom.toString().toUpperCase().trim() : null,
            prenom : isSet(data.prenom) ? data.prenom.toString().toUpperCase().trim() : null,
            tel1 : isSet(data.tel1) ? formatPhone(data.tel1) : null,
            cp : isSet(data.cp) ? data.cp : null
        }
        
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
            throw `FUEGO api/affecteVendeurRDV - Le client n'existe pas : ** ${infosLog} **`
        }

        const temp_rdv = {
            idClient : client.id,
            source : data.origine,
            date : moment(data.daterdv)
        }
        // test pour savoir si la recherche doit se faire sur le statut ou sur l'état selon ce qui est défini
        // statut
        if(tabEtat[data.etat] <= 3) {
            temp_rdv.statut = tabEtat[data.etat]
        }
        // état
        else {
            temp_rdv.idEtat = tabEtat[data.etat]
        }

        const rdv = await models.RDV.findOne({
            where : temp_rdv
        })

        if(rdv === null) {
            const infosLog = await JSON.stringify(data)
            throw `FUEGO api/affecteVendeurRDV - Le RDV n'existe pas : ** ${infosLog} **`
        }

        let idVendeur = null
        if(isSet(data.referen)) {
            idVendeur = await getIdVendeur(data.referen)
            if(idVendeur === null) {
                const infosLog = await JSON.stringify(data)
                throw `FUEGO api/affecteVendeurRDV - Le vendeur n'existe pas : ** ${infosLog} **`
            }
        }

        rdv.idVendeur = idVendeur
        await rdv.save()

        infos = clientInformationObject(undefined, "Le vendeur a bien été affecté dans FUEGO.")
    }
    catch(error) {
        infos = clientInformationObject(error)
    }
    
    res.send({ infos })
})
.patch('/modifieRDV', async (req, res) => {
    let infos = undefined
    const data = req.body
    
    try {
        const temp_client = {
            id_hitech : isSet(data.client.id_hitech) ? data.client.id_hitech : null,
            nom : isSet(data.client.nom) ? data.client.nom.toString().toUpperCase().trim() : null,
            prenom : isSet(data.client.prenom) ? data.client.prenom.toString().toUpperCase().trim() : null,
            tel1 : isSet(data.client.tel1) ? formatPhone(data.client.tel1) : null,
            cp : isSet(data.client.cp) ? data.client.cp : null
        }
        
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
            throw `FUEGO api/modifieRDV - Le client n'existe pas : ** ${infosLog} **`
        }

        const temp_rdv = {
            idClient : client.id,
            source : data.rdv_old.origine,
            date : moment(data.rdv_old.daterdv)
        }
        // test pour savoir si la recherche doit se faire sur le statut ou sur l'état selon ce qui est défini
        // statut
        if(tabEtat[data.rdv_old.etat] <= 3) {
            temp_rdv.statut = tabEtat[data.rdv_old.etat]
        }
        // état
        else {
            temp_rdv.idEtat = tabEtat[data.rdv_old.etat]
        }

        const rdv = await models.RDV.findOne({
            where : temp_rdv
        })

        if(rdv === null) {
            const infosLog = await JSON.stringify(data)
            throw `FUEGO api/modifieRDV - Le RDV n'existe pas : ** ${infosLog} **`
        }

        rdv.source = data.rdv_new.origine
        rdv.date = moment(data.rdv_new.daterdv)
        rdv.prisavec = data.rdv_new.prisavec
        rdv.r = isSet(data.rdv_new.r) ? data.rdv_new.r.slice(1) : null
        rdv.idVendeur = isSet(data.rdv_new.referen) ? await getIdVendeur(data.rdv_new.referen) : null
        // dans le cadre d'un rapport
        if(isSet(data.rdv_new.cr)) {
            rdv.idVendeur = isSet(data.rdv_new.cr.vendeur) ? await getIdVendeur(data.rdv_new.cr.vendeur) : null
            rdv.commentaire = isSet(data.rdv_new.cr.obsvente) ? data.rdv_new.cr.obsvente : null
            // rdv.idEtat = isSet(data.rdv_new.cr) ? ((isSet(data.rdv_new.cr.qualiter) && tabEtat[data.rdv_new.cr.qualiter] !== undefined) ? tabEtat[data.rdv_new.cr.qualiter] : '15') : null
            rdv.idEtat = isSet(data.rdv_new.etat) ? ((isSet(tabEtat[data.rdv_new.etat]) && tabEtat[data.rdv_new.etat] !== undefined) ? tabEtat[data.rdv_new.etat] : '15') : null
        }
        if(isSet(data.rdv_new.etat) && data.rdv_new.etat === 'A REPOSITIONNER') {
            rdv.statut = tabEtat['A repositionner']
        }

        await rdv.save()

        client.commentaire = isSet(data.rdv_new.presclient) ? data.rdv_new.presclient : null
        setInstallationClient(client, data.rdv_new)

        await client.save()

        infos = clientInformationObject(undefined, 'Le RDV a bien été modifié dans FUEGO.')
    }
    catch(error) {
        infos = clientInformationObject(error)
    }
    
    res.send({ infos })
})
// met hors criteres un rdv
.patch('/RDVHorsCriteres', async (req, res) => {
    let infos = undefined
    const data = req.body
    
    try {
        const temp_client = {
            id_hitech : isSet(data.client.id_hitech) ? data.client.id_hitech : null,
            nom : isSet(data.client.nom) ? data.client.nom.toString().toUpperCase().trim() : null,
            prenom : isSet(data.client.prenom) ? data.client.prenom.toString().toUpperCase().trim() : null,
            tel1 : isSet(data.client.tel1) ? formatPhone(data.client.tel1) : null,
            cp : isSet(data.client.cp) ? data.client.cp : null
        }
        
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
            throw `FUEGO api/RDVHorsCriteres - Le client n'existe pas : ** ${infosLog} **`
        }

        const temp_rdv = {
            idClient : client.id,
            source : data.rdv.origine,
            date : moment(data.rdv.daterdv)
        }
        // test pour savoir si la recherche doit se faire sur le statut ou sur l'état selon ce qui est défini
        // statut
        if(tabEtat[data.rdv.etat] <= 3) {
            temp_rdv.statut = tabEtat[data.rdv.etat]
        }
        // état
        else {
            temp_rdv.idEtat = tabEtat[data.rdv.etat]
        }

        const rdv = await models.RDV.findOne({
            where : temp_rdv
        })

        if(rdv === null) {
            const infosLog = await JSON.stringify(data)
            throw `FUEGO api/RDVHorsCriteres - Le RDV n'existe pas : ** ${infosLog} **`
        }

        // mise en hors critères et affectation du commentaire
        rdv.idEtat = tabEtat['HC']
        rdv.commentaire = isSet(data.commentaire) ? data.commentaire : null

        await rdv.save()

        infos = clientInformationObject(undefined, 'Le RDV est bien passé en Hors Critères dans FUEGO.')
    }
    catch(error) {
        infos = clientInformationObject(error)
    }
    
    res.send({ infos })
})
.delete('/deleteRDV', async (req, res) => {
    let infos= undefined
    const data = req.body
    
    try {
        const temp_client = {
            id_hitech : isSet(data.client.id_hitech) ? data.client.id_hitech : null,
            nom : isSet(data.client.nom) ? data.client.nom.toString().toUpperCase().trim() : null,
            prenom : isSet(data.client.prenom) ? data.client.prenom.toString().toUpperCase().trim() : null,
            tel1 : isSet(data.client.tel1) ? formatPhone(data.client.tel1) : null,
            cp : isSet(data.client.cp) ? data.client.cp : null
        }
        
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
            throw `FUEGO api/deleteRDV - Le client n'existe pas : ** ${infosLog} **`
        }

        const temp_rdv = {
            idClient : client.id,
            source : data.rdv.origine,
            date : moment(data.rdv.daterdv)
        }
        // test pour savoir si la recherche doit se faire sur le statut ou sur l'état selon ce qui est défini
        // statut
        if(tabEtat[data.rdv.etat] <= 3) {
            temp_rdv.statut = tabEtat[data.rdv.etat]
        }
        // état
        else {
            temp_rdv.idEtat = tabEtat[data.rdv.etat]
        }

        const rdv = await models.RDV.findOne({
            where : temp_rdv
        })

        if(rdv === null) {
            const infosLog = await JSON.stringify(data)
            throw `FUEGO api/deleteRDV - Le RDV n'existe pas : ** ${infosLog} **`
        }

        await rdv.destroy()

        const historique = await models.Historique.findOne({
            where : {
                idRdv : rdv.id
            }
        })

        if(historique === null) {
            const infosLog = await JSON.stringify(data)
            throw `FUEGO api/deleteRDV - L'historique du RDV n'existe pas : ** ${infosLog} **`
        }

        await historique.destroy()

        infos = clientInformationObject(undefined, 'Le RDV a bien été supprimé dans FUEGO.')
    }
    catch(error) {
        infos = clientInformationObject(error)
    }
    
    res.send({ infos })
})


router.get('/:Id' ,(req, res, next) => {
    
    let currentres = res;

    res.status(200)

    request(API_EZQUAL+'/clientstofuego.php?id='+req.params.Id, { json: true }, (err, res, body) => {
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
            nom: typeof body.nom != 'undefined' ? body.nom.toString().toUpperCase().trim() : null,
            prenom: typeof body.prenom != 'undefined' ? body.prenom.toString().toUpperCase().trim() : null,
            tel1: typeof body.tel1 != 'undefined' ? formatPhone(body.tel1) : null,
            tel2: typeof body.tel2 != 'undefined' ? formatPhone(body.tel2) : null,
            tel3: typeof body.tel3 != 'undefined' ? formatPhone(body.tel3) : null,
            adresse: typeof body.adresse != 'undefined' ? body.adresse.toString().toUpperCase().trim() : null,
            cp: typeof body.cp != 'undefined' ? body.cp : null,
            dep: typeof body.cp != 'undefined' ? body.cp.toString().substr(0,2) : null,
            ville: typeof body.ville != 'undefined' ? body.ville.toString().toUpperCase().trim() : null,
            relation: typeof body.situafam != 'undefined' ? body.situafam.toString().toUpperCase().trim() : null,
            pro1: typeof body.situapro != 'undefined' ? body.situapro.toString().toUpperCase().trim() : null,
            pdetail1: typeof body.situapro_pres != 'undefined' ? body.situapro_pres.toString().toUpperCase().trim() : null,
            age1: typeof body.age != 'undefined' ? parseInt(body.age) : null,
            pro2: typeof body.situapro2 != 'undefined' ? body.situapro2.toString().toUpperCase().trim() : null,
            pdetail2: typeof body.situapro2_pres != 'undefined' ? body.situapro2_pres.toString().toUpperCase().trim() : null,
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
                                        date: element.daterdv,
                                        prisavec : element.prisavec
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

    
    rp(API_EZQUAL+'/getTabId.php?id='+req.params.cp, { json: true }, (err, res, body) => {
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
            nom: typeof body.nom != 'undefined' && body.nom != 'NULL' ? body.nom.toString().toUpperCase().trim() : null,
            prenom: typeof body.prenom != 'undefined' && body.prenom != 'NULL' ? body.prenom.toString().toUpperCase().trim() : null,
            tel1: typeof body.tel1 != 'undefined' && body.tel1 != 'NULL' ? formatPhone(body.tel1) : null,
            tel2: typeof body.tel2 != 'undefined' && body.tel2 != 'NULL' ? formatPhone(body.tel2) : null,
            tel3: typeof body.tel3 != 'undefined' && body.tel3 != 'NULL' ? formatPhone(body.tel3) : null,
            adresse: typeof body.adresse != 'undefined' && body.adresse != 'NULL' ? body.adresse.toString().toUpperCase().trim() : null,
            cp: typeof body.cp != 'undefined' && body.cp != 'NULL' ? body.cp : null,
            dep: typeof body.cp != 'undefined' && body.cp != 'NULL' ? body.cp.toString().substr(0,2) : null,
            ville: typeof body.ville != 'undefined' && body.ville != 'NULL' ? body.ville.toString().toUpperCase().trim() : null,
            relation: typeof body.situafam != 'undefined' && body.situafam != 'NULL' ? body.situafam.toString().toUpperCase().trim() : null,
            pro1: typeof body.situapro != 'undefined' && body.situapro != 'NULL' ? body.situapro.toString().toUpperCase().trim() : null,
            pdetail1: typeof body.situapro_pres != 'undefined' && body.situapro_pres != 'NULL' ? body.situapro_pres.toString().toUpperCase().trim() : null,
            age1: typeof body.age != 'undefined' && body.age != 'NULL' ? parseInt(body.age) : null,
            pro2: typeof body.situapro2 != 'undefined' && body.situapro2 != 'NULL' ? body.situapro2.toString().toUpperCase().trim() : null,
            pdetail2: typeof body.situapro2_pres != 'undefined' && body.situapro2_pres != 'NULL' ? body.situapro2_pres.toString().toUpperCase().trim() : null,
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
            nom: typeof body.nom != 'undefined' && body.nom != 'NULL' ? body.nom.toString().toUpperCase().trim() : null,
            prenom: typeof body.prenom != 'undefined' && body.prenom != 'NULL' ? body.prenom.toString().toUpperCase().trim() : null,
            tel1: typeof body.tel1 != 'undefined' && body.tel1 != 'NULL' ? formatPhone(body.tel1) : null,
            tel2: typeof body.tel2 != 'undefined' && body.tel2 != 'NULL' ? formatPhone(body.tel2) : null,
            tel3: typeof body.tel3 != 'undefined' && body.tel3 != 'NULL' ? formatPhone(body.tel3) : null,
            adresse: typeof body.adresse != 'undefined' && body.adresse != 'NULL' ? body.adresse.toString().toUpperCase().trim() : null,
            cp: typeof body.cp != 'undefined' && body.cp != 'NULL' ? body.cp : null,
            dep: typeof body.cp != 'undefined' && body.cp != 'NULL' ? body.cp.toString().substr(0,2) : null,
            ville: typeof body.ville != 'undefined' && body.ville != 'NULL' ? body.ville.toString().toUpperCase().trim() : null,
            relation: typeof body.situafam != 'undefined' && body.situafam != 'NULL' ? body.situafam.toString().toUpperCase().trim() : null,
            pro1: typeof body.situapro != 'undefined' && body.situapro != 'NULL' ? body.situapro.toString().toUpperCase().trim() : null,
            pdetail1: typeof body.situapro_pres != 'undefined' && body.situapro_pres != 'NULL' ? body.situapro_pres.toString().toUpperCase().trim() : null,
            age1: typeof body.age != 'undefined' && body.age != 'NULL' ? parseInt(body.age) : null,
            pro2: typeof body.situapro2 != 'undefined' && body.situapro2 != 'NULL' ? body.situapro2.toString().toUpperCase().trim() : null,
            pdetail2: typeof body.situapro2_pres != 'undefined' && body.situapro2_pres != 'NULL' ? body.situapro2_pres.toString().toUpperCase().trim() : null,
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

    if(phoneNumber != null && typeof phoneNumber != 'undefined' && phoneNumber != '' && phoneNumber != ' '){
        phoneNumber = cleanit(phoneNumber);
	    phoneNumber = phoneNumber.split(' ').join('')
        phoneNumber = phoneNumber.split('.').join('')

        if(phoneNumber.length != 10){

            phoneNumber = '0'+phoneNumber;

            if(phoneNumber.length != 10){
                return null
            }else{
                return phoneNumber
            }
        }else{
            return phoneNumber
        }
    }

    return null

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
    // états
    'ABS': '7',
    'ANNULE': '6',
    'ANNULE AU REPORT': '6',
    // 'Confirmé': '5',
    'DECOUVERTE': '8',
    'DEEM': '3',
    'DEM': '3',
    // 'En cours': '4',
    'En cours' : 0,
    'HC': '14',
    'PAS eTe': '10',
    'REFUS': '11',
    'REFUS DEM': '11',
    'A REPOSITIONNER' : 13,
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
    'Valide(VENTE ADD)': '1',
    'Valide(VENTE)': '1',
    'NON RETROUVE' : '15',
    // statut
    'Confirmé' : 1,
    'Non Confirmé' : 0,
    'A repositionner' : 3
}