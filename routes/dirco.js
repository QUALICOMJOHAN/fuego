const express = require('express')
const moment = require('moment')
const models = require("../models/index")
const sequelize = require("sequelize")
const router = express.Router()
const Op = sequelize.Op

router.get('/' ,(req, res, next) => {
    res.redirect('/vendeur/dirco_dashboard');
});

router.get('/tableau-de-bord' ,(req, res, next) => {

    let idDependence = []
    req.session.client.Usersdependences.forEach((element => {
        idDependence.push(element.idUserInf)    
    }))

    if(idDependence.length == 0){
        idDependence.push(1000) 
        idDependence.push(1001) 
    }

    models.sequelize.query("SELECT CONCAT(Users.nom, ' ', Users.prenom) as commercial, count(RDVs.id) as count FROM RDVs LEFT JOIN Users ON RDVs.idVendeur=Users.id LEFT JOIN UserStructures ON Users.id=UserStructures.idUser LEFT JOIN Structures ON UserStructures.idStructure=Structures.id WHERE idVendeur IN (:dependence) AND date LIKE :date AND statut = 1 GROUP BY commercial", { replacements: {dependence: idDependence, date: moment().format('YYYY-MM-DD')+'%'}, type: sequelize.QueryTypes.SELECT})
    .then(findedRdvToday => {
        models.sequelize.query("SELECT CONCAT(Users.nom, ' ', Users.prenom) as commercial, count(RDVs.id) as count FROM RDVs LEFT JOIN Users ON RDVs.idVendeur=Users.id LEFT JOIN UserStructures ON Users.id=UserStructures.idUser LEFT JOIN Structures ON UserStructures.idStructure=Structures.id WHERE idVendeur IN (:dependence) AND date LIKE :date AND statut = 1 GROUP BY commercial", { replacements: {dependence: idDependence, date: moment().add(1, 'days').format('YYYY-MM-DD')+'%'}, type: sequelize.QueryTypes.SELECT})
        .then(findedRdvTomorow => {
            res.render('./vendeur/dirco_dashboard', { extractStyles: true, title: 'Tableau de bord | FUEGO', description :'Tableau de bord Directeur Commercial', session: req.session.client, options_top_bar: 'commerciaux', today: findedRdvToday, tomorow: findedRdvTomorow});
        });
   });
});

router.get('/rendez-vous' ,(req, res, next) => {
    let idDependence = []
    req.session.client.Usersdependences.forEach((element => {
        idDependence.push(element.idUserInf)    
    }))

    if(idDependence.length == 0){
        idDependence.push(1000) 
        idDependence.push(1001) 
    }

    models.RDV.findAll({
        include: [
            {model : models.Client},
            {model : models.Historique},
            {model : models.User, where : { 
                id: { 
                    [Op.in] : idDependence
                }
            },include: models.Structure},
            {model : models.Etat},
            {model : models.Campagne}
        ],
        where: {
            date : {
               [Op.substring] : [moment().format('YYYY-MM-DD')]
            },
            statut: 1
        },
        order: [['date', 'asc']],
    }).then(findedRdvs => {
        models.RDV.findAll({
            include: [
                {model : models.Client},
                {model : models.Historique},
                {model : models.User, where : { 
                    id: { 
                        [Op.in] : idDependence
                    }
                },include: models.Structure},
                {model : models.Etat},
                {model : models.Campagne}
            ],
            where: {
                date : {
                   [Op.substring] : [moment().add(1, 'day').format('YYYY-MM-DD')]
                },
                statut: 1
            },
            order: [['idVendeur', 'asc'],['date', 'asc']],
        }).then(findedRdvsp => {
            res.render('vendeur/dirco_rdv', { extractStyles: true, title: 'Tableau de bord | FUEGO', description:'Tableau de bord Commercial', findedRdvs: findedRdvs, findedRdvsp: findedRdvsp, session: req.session.client, options_top_bar: 'commerciaux'});
        }).catch(function (e) {
            console.log('error', e);
        });
    }).catch(function (e) {
        console.log('error', e);
    });
});

router.get('/agenda' ,(req, res, next) => {
    res.render('./vendeur/dirco_agenda', { extractStyles: true, title: 'Agenda | FUEGO',  description :'Agenda Directeur Commercial', session: req.session.client,options_top_bar: 'commerciaux'});
});

router.get('/historique' ,(req, res, next) => {
    let idDependence = []
    req.session.client.Usersdependences.forEach((element => {
        idDependence.push(element.idUserInf)    
    }))

    if(idDependence.length == 0){
        idDependence.push(1000) 
        idDependence.push(1001) 
    }

    models.RDV.findAll({
        include: [
            {model : models.Client},
            {model : models.Historique},
            {model : models.User, where : { 
                id: { 
                    [Op.in] : idDependence
                }
            },include: models.Structure},
            {model : models.Etat},
            {model : models.Campagne}
        ],
        where: {
            date : {
               [Op.substring] : [moment().format('YYYY-MM-DD')]
            },
            idEtat: {
                [Op.not]: null
            }
        },
        order: [['date', 'asc']],
    }).then(findedRdvs => {
        res.render('./vendeur/dirco_histo', { extractStyles: true, title: 'Historique | FUEGO',  description :'Historique Directeur Commercial', findedRdvs: findedRdvs ,options_top_bar: 'commerciaux'});
    })
});

router.post('/event' ,(req, res, next) => {
    let idDependence = []
    req.session.client.Usersdependences.forEach((element => {
        idDependence.push(element.idUserInf)    
    }))

    if(idDependence.length == 0){
        idDependence.push(1000) 
        idDependence.push(1001) 
    }

    models.sequelize.query("SELECT CONCAT(Clients.nom, '_', cp) as title, date as start, DATE_ADD(date, INTERVAL 2 HOUR) as end, backgroundColor FROM RDVs LEFT JOIN Clients ON RDVs.idClient=Clients.id LEFT JOIN Users ON RDVs.idVendeur=Users.id LEFT JOIN UserStructures ON Users.id=UserStructures.idUser LEFT JOIN Structures ON UserStructures.idStructure=Structures.id LEFT JOIN Depsecteurs ON Clients.dep=Depsecteurs.dep LEFT JOIN Secteurs ON Secteurs.id=Depsecteurs.idSecteur WHERE idVendeur IN (:dependence) AND statut=1", { replacements: {dependence: idDependence}, type: sequelize.QueryTypes.SELECT})
    .then(findedEvent => {
        res.send(findedEvent)
    });
});

module.exports = router;