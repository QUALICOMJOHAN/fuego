$(document).ready(async () => {
    await actualiserRdv()

    $('.loadingbackground').hide()
})

async function actualiserRdv(message = undefined) {
    const div_info = document.getElementById('info_message')
    const div_rdvs = document.getElementById('displayrdv')

    $('.loadingbackground').show()

    div_info.innerText = ''
    div_info.style.display = 'none'
    div_info.classList.remove('info_message')
    div_info.classList.remove('error_message')
    div_rdvs.innerHTML = ''

    try {
        const response = await fetch('/commerciaux/a-traiter/listeRdvs')

        if(!response.ok) throw "Une erreur est survenue lors de la récupération des RDVs, veuillez réessayer plus tard."

        const data = await response.json()

        if(data.infoObject && data.infoObject.error) throw data.infoObject.error

        if(data.infoObject && data.infoObject.message) {
            div_rdvs.innerHTML = `<div class="col-md-12"><p>${data.infoObject.message}</p></div>`
        }
        else {
            for(const rdv of data.listeRdvs) {
                const blocRDV = new EJS({ url: '/public/views/partials/rdvs/bloc_rdv_jour'}).render({ rdv })
                $('.rdvs').append(blocRDV)
                const optionBlocRDV = new EJS({ url: '/public/views/partials/badging/option_rdv'}).render({ rdv })
                $('.options_template:last').append(optionBlocRDV)
            }
            
            reload_js('/public/assets/js/bloc_rdv.js')
            setClick()

            if(message) {
                div_info.innerText = message
                div_info.classList.add('info_message')
                div_info.style.display = 'block'
            }
        }
    }
    catch(e) {
        div_info.innerText = e
        div_info.classList.add('error_message')
        div_info.style.display = 'block'
    }

    $('.loadingbackground').hide()
}

function reload_js(src) {
    $('script[src="' + src + '"]').remove();
    $('<script>').attr('src', src).appendTo('head');
}

function setErrorMessage(message) {
    const div = document.getElementById('div_info')
    const p = div.getElementsByTagName('p')[0]

    p.classList.add('error_message')
    p.innerText = message
    div.style.display = 'block'
}

function setInformationMessage(message) {
    const div = document.getElementById('div_info')
    const p = div.getElementsByTagName('p')[0]

    p.classList.add('info_message')
    p.innerText = message
    div.style.display = 'block'
}

function removeErrorMessage() {
    const div = document.getElementById('div_info')
    const p = div.getElementsByTagName('p')[0]

    p.innerText = ''
    p.classList.remove('error_message')
    p.classList.remove('info_message')
    div.style.display = 'none'
}

function setClick(){
    $('.un').click((event) => {
        const info_message = document.getElementById('info_message')
        info_message.style.display = 'none'
        info_message.innerText = ''
        info_message.classList.remove('error_message')
        info_message.classList.remove('info_message')

        $.ajax({
            url: '/manager/compte-rendu',
            method: 'POST',
            data: {
                id: $(event.currentTarget).attr('id')
            }
            }).done((data) => {
                $('#modal_liste_RDV').html('');
                let modal = new EJS({ url: '/public/views/partials/modals/modal_compte_rendu'}).render(data)
                $('#modal_liste_RDV').append(modal).ready(() => {
                    $('#modal_liste_RDV').modal({
                        fadeDuration: 100
                    }).ready(() => {
                        
                        $(".daterdv_edit").attr('disabled', true)
                        setSelectChange()

                        $('.save').click(async (event) => {
                            // traitement de la div d'informations
                            // const modalDivInfo = document.getElementById('div_info')
                            // const modalDivInfo_p = modalDivInfo.querySelector('p')
                            // modalDivInfo.style.display = 'none'
                            // modalDivInfo_p.innerHTML = ''
                            // modalDivInfo_p.classList.remove('error_message')
                            // modalDivInfo_p.classList.remove('info_message')

                            // let compteRendu = {
                            //     statut: $("input[name=statut]:checked").val(),
                            //     idEtat: $("select[name=idEtat]").children("option").filter(":selected").val() == "" ? null : $("select[name=idEtat]").children("option").filter(":selected").val(),
                            //     idRdv: $("input[name=idRdv]").val(),
                            //     idVendeur: $("select[name=idVendeur]").children("option").filter(":selected").val() == "" ? null : $("select[name=idVendeur]").children("option").filter(":selected").val(),
                            //     date: $("input[name=date]").val(),
                            //     commentaire: $("input[name=commentaire]").val(),
                            //     commentaireNew: $("input[name=commentairerepo]").val(),
                            //     datenew: $("input[name=daterepo]").val(),
                            //     rnew: $("input[name=r]").val(),
                            //     sousstatut : $('.traitementactive').html() ? $('.traitementactive').html() : null,
                            //     commentaireHC : $('input[name=commentaireHC]').val(),
                            //     dateRappel : (document.querySelector("input[name=statut]:checked").getAttribute('id') === 'checkarepo') ? ($("input[name=daterappel]").val() !== '' ? $("input[name=daterappel]").val() : undefined) : undefined,
                            //     commentaireRappel : (document.querySelector("input[name=statut]:checked").getAttribute('id') === 'checkarepo') ? ($("input[name=commentaire_rappel]").val() !== '' ? $("input[name=commentaire_rappel]").val() : undefined) : undefined
                            // }

                            // try {
                            //     const url = '/manager/update/compte-rendu'
                            //     const option = {
                            //         method : 'POST',
                            //         headers : new Headers({
                            //             "Content-type" : "application/json"
                            //         }),
                            //         body : JSON.stringify(compteRendu)
                            //     }

                            //     const response = await fetch(url, option)
                            //     if(!response.ok) throw "Une erreur est survenue, veuillez réessayer plus tard."

                            //     const data = await response.json()

                            //     if(data.infoObject && data.infoObject.error) throw data.infoObject.error
                            //     else if(data.infoObject && data.infoObject.message) actualiserRdv(data.infoObject.message)
                            //     else actualiserRdv()

                            //     $.modal.close()
                            // }
                            // catch(e) {
                            //     modalDivInfo_p.classList.add('error_message')
                            //     modalDivInfo_p.innerHTML = e
                            // }
                            // finally {
                            //     modalDivInfo.style.display = 'block'
                            // }
                            removeErrorMessage()

                                try {
                                    const compteRendu = {
                                        statut: $("input[name=statut]:checked").val(),
                                        idEtat: $("select[name=idEtat]").children("option").filter(":selected").val() == "" ? null : $("select[name=idEtat]").children("option").filter(":selected").val(),
                                        idRdv: $("input[name=idRdv]").val(),
                                        idVendeur: $("select[name=idVendeur]").children("option").filter(":selected").val() == "" ? null : $("select[name=idVendeur]").children("option").filter(":selected").val(),
                                        date: $("input[name=date]").val(),
                                        // commentaire: $("input[name=commentaire]").val(),
                                        commentaire: $("textarea[name=commentaireRDV]").val(),
                                        commentaireNew: $("input[name=commentairerepo]").val(),
                                        datenew: $("input[name=daterepo]").val(),
                                        rnew: $("input[name=r]").val(),
                                        sousstatut : $('.traitementactive').html() ? $('.traitementactive').html() : null,
                                        commentaireHC : $('input[name=commentaireHC]').val(),
                                        dateRappel : (document.querySelector("input[name=statut]:checked").getAttribute('id') === 'checkarepo') ? ($("input[name=daterappel]").val() !== '' ? $("input[name=daterappel]").val() : undefined) : undefined,
                                        commentaireRappel : (document.querySelector("input[name=statut]:checked").getAttribute('id') === 'checkarepo') ? ($("input[name=commentaire_rappel]").val() !== '' ? $("input[name=commentaire_rappel]").val() : undefined) : undefined,
                                        montantVente : $('input[name=montantVente]').val()
                                    }

                                    const url = '/manager/update/compte-rendu'
                                    const option = {
                                        method : 'POST',
                                        headers : new Headers({
                                            "Content-type" : "application/json"
                                        }),
                                        body : JSON.stringify(compteRendu)
                                    } 

                                    const response = await fetch(url, option)
                                    if(!response.ok) throw generalError

                                    const data = await response.json()
                                    if(data.infoObject) {
                                        if(data.infoObject.error) throw data.infoObject.error
                                        if(data.infoObject.message) setInformationMessage(data.infoObject.message)
                                    }

                                    $.modal.close()
                                    window.location.assign('/commerciaux/tableau-de-bord')
                                }
                                catch(e) {
                                    setErrorMessage(e)
                                }
                        })
                        
                        $('.datetimepicker').datetimepicker({
                            language: 'fr-FR',
                            format:'d/m/Y H:i',
                            allowTimes: [
                                '9:00', '9:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'
                            ]
                        });
                    })
                    reload_js('/public/assets/js/modifier_client.js');
                })
                let info = new EJS({ url: '/public/views/partials/traitementclient/info_client'}).render({findedClient: data.findedRdv.Client})
                $('.ctn_infos_client').append(info)
        })
    })
}

function setSelectChange(){
    const toExecute = () => {
        if($('.resultatrdv option:selected').val() == 12 || $('.resultatrdv option:selected').val() == 13 || $('.resultatrdv option:selected').val() == 2){
            $('.date_repo').show()
        }else{
            $('.date_repo').hide()
        }

        if($('.resultatrdv option:selected').val() == 14) {
            showHC('compteRendu_HC')            
        }
        else if(document.getElementById('div_HC').parentNode.getAttribute('id') === 'compteRendu_HC') {
            hideHC()            
        }

        // VENTE
        if($('.resultatrdv option:selected').val() == 1) {
            $('#div_Vente').show()
        }
        else {
            $('#div_Vente').hide()
        }
    }

    const selectCompteRendu = document.querySelector('.resultatrdv')

    selectCompteRendu.onclick = toExecute
    selectCompteRendu.onchange = toExecute
}

function switchSousStatut({ target }) {
    if(target.classList.contains('traitementactive')) {
        target.classList.remove('traitementactive')
    }
    else {
        const liste_actifs = document.querySelectorAll('.traitementactive')
        if(liste_actifs.length > 0) {
            for(const btn of liste_actifs) {
                btn.classList.remove('traitementactive')
            }
        }

        target.classList.add('traitementactive')
    }
}

function showHC(id) {
    $(`#${id}`).append($('#div_HC'))
    $('#div_HC').show()

    const liste_btn_traitement = document.getElementsByClassName('btn_traitement')
    if(liste_btn_traitement.length > 0) {
        for(const btn of liste_btn_traitement) {
            btn.onclick = switchSousStatut
        }
    }
}

function hideHC() {
    $('#div_HC').hide()
    $('.btn_traitement').removeClass('traitementactive');
    document.querySelector('#div_HC input[name=commentaireHC]').value = ''
}