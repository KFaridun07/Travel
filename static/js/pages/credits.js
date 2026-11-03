// Авторы фотографий: свободные лицензии требуют указать автора и лицензию

var PHOTO_CREDITS = [
    ['img/places/iskanderkul.jpg', 'Iskenderkul.jpg', 'Emad Nemati', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Iskenderkul.jpg'],
    ['img/places/hisor.jpg', 'Gissar (Hisor) fortress - panoramio.jpg', 'Maris Teteris', 'CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0', 'https://commons.wikimedia.org/wiki/File:Gissar_(Hisor)_fortress_-_panoramio.jpg'],
    ['img/places/museum.jpg', 'Национальный музей Таджикистана.jpg', 'Шухрат Саъдиев', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:%D0%9D%D0%B0%D1%86%D0%B8%D0%BE%D0%BD%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D0%B9_%D0%BC%D1%83%D0%B7%D0%B5%D0%B9_%D0%A2%D0%B0%D0%B4%D0%B6%D0%B8%D0%BA%D0%B8%D1%81%D1%82%D0%B0%D0%BD%D0%B0.jpg'],
    ['img/places/nurek.jpg', 'Nurek Reservoir, Tajikistan.jpg', 'Nikolamikovic82', 'CC0', 'https://creativecommons.org/publicdomain/zero/1.0/deed.en', 'https://commons.wikimedia.org/wiki/File:Nurek_Reservoir,_Tajikistan.jpg'],
    ['img/places/pamir.jpg', 'Pamir highway near karakul.JPG', 'Hylgeriak / Wikipedia', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Pamir_highway_near_karakul.JPG'],
    ['img/places/khujand.jpg', 'Қалъаи Хуҷанд (64284).jpg', 'VASHGIRD', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'https://commons.wikimedia.org/wiki/File:%D2%9A%D0%B0%D0%BB%D1%8A%D0%B0%D0%B8_%D0%A5%D1%83%D2%B7%D0%B0%D0%BD%D0%B4_(64284).jpg'],
    ['img/places/penjikent.jpg', 'Bunjikath, Tajikistan (494266).jpg', 'upyernoz from Haverford, USA', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:Bunjikath,_Tajikistan_(494266).jpg'],
    ['img/places/marguzor.jpg', 'Lakes of Tajikistan 31.JPG', 'Шухрат Саъдиев', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Lakes_of_Tajikistan_31.JPG'],
    ['img/places/registan.jpg', 'Registan 01.jpg', 'Bernard Gagnon', 'CC0', 'https://creativecommons.org/publicdomain/zero/1.0/deed.en', 'https://commons.wikimedia.org/wiki/File:Registan_01.jpg'],
    ['img/places/bukhara.jpg', 'Kalan Minaret 02.jpg', 'Bgag', 'CC0', 'https://creativecommons.org/publicdomain/zero/1.0/deed.en', 'https://commons.wikimedia.org/wiki/File:Kalan_Minaret_02.jpg'],
    ['img/scenes/hero_fann.jpg', 'Kulikalon Lake and Fann Mountains.jpg', 'Adam Harangozó', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Kulikalon_Lake_and_Fann_Mountains.jpg'],
    ['img/scenes/hero_pamir.jpg', 'From Langar to Murghab, Tajikistan (44176726742).jpg', 'Ninara from Helsinki, Finland', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:From_Langar_to_Murghab,_Tajikistan_(44176726742).jpg'],
    ['img/scenes/hero_registan.jpg', 'Memorial complex "Registan" in Samarkand (12).jpg', 'veton.picq.fr', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Memorial_complex_%22Registan%22_in_Samarkand_(12).jpg'],
    ['img/scenes/auth_alaudin.jpg', 'Alaudin Lake in Fann Mountains.jpg', 'Adam Harangozó', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Alaudin_Lake_in_Fann_Mountains.jpg']
];

function creditsPage() {
    setCoverPage(false);
    setTitle(t('creditsTitle'));

    var html = '';
    for (var i = 0; i < PHOTO_CREDITS.length; i++) {
        var photo = PHOTO_CREDITS[i];
        html = html + '<article class="credit"><img src="' + esc(staticUrl(photo[0])) + '" alt="" loading="lazy"><div>' +
            '<strong><a href="' + esc(photo[5]) + '" target="_blank" rel="noopener">' + esc(photo[1]) + '</a></strong>' +
            '<span>' + esc(t('photoAuthor')) + ': ' + esc(photo[2]) + '</span>' +
            '<span>' + esc(t('photoLicense')) + ': <a href="' + esc(photo[4]) + '" target="_blank" rel="noopener">' + esc(photo[3]) + '</a></span>' +
            '</div></article>';
    }

    mainElement.innerHTML = '<div class="container"><div class="page-head"><h1>' + esc(t('creditsTitle')) + '</h1><p>' + esc(t('creditsText')) + '</p></div>' +
        '<div class="page-body"><div class="credit-grid">' + html + '</div></div></div>';
}
