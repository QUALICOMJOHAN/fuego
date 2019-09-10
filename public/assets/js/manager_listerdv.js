$(document).ready(() => {
    
    $('#rechercher_listerdv').keyup(function (e) {
        recherche($(e.currentTarget).val());
    });

    $('.selectdate_rdv :input').change(() => {

        let date= {}
        $('.selectdate_rdv :input').each((index, element) => {
            if(element.value != ''){
                date[element.name] = element.value
            }
        });

        if("datedebut" in date){
            if(!("datefin" in date)){
                date['datefin'] = date['datedebut']
            }
            $.ajax({
                url: '/manager/liste-rendez-vous',
                method: 'POST',
                data: date
             }).done((data) => {
                $('.rdvs').html('');
                console.log(data);
                if(data != 0){
                    data.forEach(element => {
                        let rdv = new EJS({ url: '/public/views/partials/bloc_rdv_jour'}).render({rdv: element});
                        $('.rdvs').append(rdv)
                        let option = new EJS({ url: '/public/views/partials/option_bloc_rdv_liste'}).render();
                        $('.options_template:last').append(option)
                    });
                    reload_js('/public/assets/js/bloc_rdv.js');
                }
             });
            console.log(date)
        }else{
            console.log('Vous devez absolument choisir une date de debut')
        }
    });
});

function reload_js(src) {
    $('script[src="' + src + '"]').remove();
    $('<script>').attr('src', src).appendTo('head');
}

function recherche(entree) {
    maRegExp = new RegExp(entree, 'gi'); // expression régulière en fonction de l'entrée
    divs = $('.ctn_rdv_auj'); // toutes les div en dessous de #contenu
    for (i = 0; i < divs.length; i++) { // parcours de toutes ces div
        if (maRegExp.test($('#' + divs[i].id + ' p:first').html()) || maRegExp.test($('#' + divs[i].id + ' p:last').html()) || maRegExp.test($('#' + divs[i].id + ' p:nth-child(3)').html())) { // test de la regexp
            divs[i].style.display = "block"; // afficher
        } else {
            divs[i].style.display = "none"; // cacher
        }
    }
}