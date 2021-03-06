const express = require('express');
const router = express.Router();

router.get('/' ,(req, res, next) => {
    res.render('poses/poses_dashboard', { extractStyles: true, title: 'Tableau de bord | FUEGO', description:'Tableau de bord Poseur',  session: req.session.client, options_top_bar: 'poses'});
});


router.get('/poses_dashboard' ,(req, res, next) => {
    res.render('poses/tableau-de-bord', { extractStyles: true, title: 'Tableau de bord | FUEGO', description:'Tableau de bord Poseur',  session: req.session.client, options_top_bar: 'poses'});
});


module.exports = router;