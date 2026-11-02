from datetime import timedelta
from decimal import Decimal
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from accounts.models import CustomUser
from ai.models import ChatMessage, TripPlan
from bookings.models import Booking
from places.models import Place
from tours.models import Favorite, Review, Tour

# у всех демо-пользователей один пароль
DEMO_PASSWORD = 'Demo-Pass-492'

# логин, имя, фамилия, роль
USERS = [
    ('demo_tourist1', 'Алишер', 'Каримов', 'tourist'),
    ('demo_tourist2', 'Мадина', 'Рахимова', 'tourist'),
    ('demo_tourist3', 'Фируз', 'Саидов', 'tourist'),
    ('demo_tourist4', 'Нигина', 'Назарова', 'tourist'),
    ('demo_tourist5', 'Рустам', 'Шарипов', 'tourist'),
    ('demo_tourist6', 'Зарина', 'Юсупова', 'tourist'),
    ('demo_guide1', 'Бахтиёр', 'Мирзоев', 'guide'),
    ('demo_guide2', 'Сабина', 'Давлатова', 'guide'),
    ('demo_guide3', 'Комрон', 'Холов', 'guide'),
    ('demo_admin', 'Парвиз', 'Ахмедов', 'admin'),
]

# название, город, описание, теги
PLACES = [
    ('Озеро Искандеркуль', 'Айни', 'Горное озеро в Фанских горах с бирюзовой водой и водопадом Фан-Ниагара.', 'озеро,горы,природа,водопад'),
    ('Гиссарская крепость', 'Гиссар', 'Древняя крепость с воротами из обожжённого кирпича и старыми медресе.', 'крепость,история,архитектура'),
    ('Национальный музей Таджикистана', 'Душанбе', 'Большой музей истории, природы и искусства в центре столицы.', 'музей,история,город'),
    ('Нурекское водохранилище', 'Нурек', 'Огромное рукотворное озеро среди гор возле одной из самых высоких плотин мира.', 'озеро,горы,природа'),
    ('Памирский тракт', 'Хорог', 'Легендарная высокогорная дорога через перевалы и кишлаки Памира.', 'горы,дорога,приключения'),
    ('Крепость Худжанд', 'Худжанд', 'Старинная крепость на берегу Сырдарьи и один из древнейших городов Азии.', 'крепость,история,река'),
    ('Древний Пенджикент', 'Пенджикент', 'Руины согдийского города с дворцами, храмами и знаменитыми росписями.', 'история,археология,руины'),
    ('Семь озёр Маргузор', 'Пенджикент', 'Семь озёр разных оттенков, расположенных лестницей в Фанских горах.', 'озеро,горы,природа,поход'),
    ('Регистан', 'Самарканд', 'Главная площадь Самарканда с тремя величественными медресе.', 'площадь,история,медресе'),
    ('Старый город Бухары', 'Бухара', 'Исторический центр с минаретом Калян, куполами и торговыми рядами.', 'город,история,архитектура'),
]

# название, описание, номер места, номер гида, цена, дней, человек
TOURS = [
    ('Выходные на Искандеркуле', 'Лёгкий тур к озеру: прогулка вдоль берега, водопад и ночь в горах.', 0, 0, '850', 2, 12),
    ('Гиссар за один день', 'Экскурсия по крепости и медресе с рассказом гида об истории долины.', 1, 0, '220', 1, 15),
    ('Душанбе для новичков', 'Музеи, парки и базар: всё главное о столице за один день.', 2, 1, '180', 1, 20),
    ('Вода и горы Нурека', 'Поездка к плотине и прогулка на катере по водохранилищу.', 3, 1, '640', 2, 10),
    ('Большой Памир', 'Путешествие на внедорожниках по Памирскому тракту через высокие перевалы.', 4, 2, '6200', 9, 8),
    ('Шёлковый Худжанд', 'Крепость, базар Панчшанбе и прогулка по набережной Сырдарьи.', 5, 2, '730', 2, 14),
    ('Тайны Согда', 'Раскопки Древнего Пенджикента и местный музей вместе с археологом.', 6, 0, '560', 2, 12),
    ('Семь озёр пешком', 'Активный поход вдоль всех семи озёр с ночёвками в кишлаках.', 7, 1, '1450', 4, 10),
    ('Самарканд и Регистан', 'Главные памятники Самарканда, вечерняя площадь и местная кухня.', 8, 2, '1900', 3, 16),
    ('Неспешная Бухара', 'Старый город, минарет Калян, мастерские ремесленников и чайханы.', 9, 0, '2100', 3, 16),
]

REVIEWS = [
    (5, 'Очень красиво и спокойно. Гид всё отлично организовал.'),
    (4, 'Интересная экскурсия, но хотелось бы больше свободного времени.'),
    (5, 'Узнал о городе то, чего нет в путеводителях.'),
    (4, 'Виды потрясающие, дорога немного утомила.'),
    (5, 'Лучшее путешествие в моей жизни. Рекомендую всем.'),
    (4, 'Хорошая программа и вкусная еда на базаре.'),
    (5, 'Гид рассказывал так, что слушали и взрослые, и дети.'),
    (3, 'Красиво, но маршрут оказался сложнее, чем я ожидал.'),
    (5, 'Вечерний Регистан невозможно забыть.'),
    (4, 'Уютная атмосфера и много интересных мастерских.'),
]

QUESTIONS = [
    ('Какой тур подойдёт на выходные?', 'Советую «Выходные на Искандеркуле»: 2 дня и цена 850 сомони.'),
    ('Что посмотреть в Душанбе за день?', 'Подойдёт тур «Душанбе для новичков»: 1 день и цена 180 сомони.'),
    ('Есть ли тур в горы на неделю и больше?', 'Да, «Большой Памир» длится 9 дней и стоит 6200 сомони.'),
    ('Какой самый дешёвый тур?', 'Самый недорогой тур — «Душанбе для новичков», 180 сомони.'),
    ('Хочу посмотреть древние города.', 'Советую «Тайны Согда» или «Неспешная Бухара».'),
    ('Что подойдёт для активного отдыха?', 'Попробуйте «Семь озёр пешком»: 4 дня пешего маршрута.'),
    ('Куда поехать с детьми?', 'Подойдёт «Гиссар за один день»: тур короткий и нетрудный.'),
    ('Есть ли туры в Узбекистан?', 'Да, «Самарканд и Регистан» и «Неспешная Бухара».'),
    ('Есть ли туры в Париж?', 'Нет, в нашем списке туров в Париж нет.'),
    ('Где можно покататься на катере?', 'Такая прогулка есть в туре «Вода и горы Нурека».'),
]

# город, дней, бюджет, интересы
PLANS = [
    ('Душанбе', 2, '500', 'музеи, еда'),
    ('Самарканд', 3, '1500', 'история, архитектура'),
    ('Бухара', 2, '1000', 'ремёсла, чайханы'),
    ('Худжанд', 2, '700', 'базары, река'),
    ('Пенджикент', 3, '900', 'археология, горы'),
    ('Хорог', 5, '4000', 'горы, дороги'),
    ('Айни', 2, '800', 'озёра, походы'),
    ('Нурек', 1, '300', 'природа, вода'),
    ('Гиссар', 1, '200', 'крепости, история'),
    ('Душанбе', 4, '1200', 'парки, семейный отдых'),
]


class Command(BaseCommand):
    help = 'Создаёт демо-данные. Команду можно запускать снова: дублей не будет.'

    def handle(self, *args, **options):
        # на настоящем сайте не нужны пользователи с известным паролем
        if not settings.DEBUG:
            raise CommandError('Демо-данные можно создавать только при DEBUG = True')

        users = self.create_users()
        tourists = users[:6]
        guides = users[6:9]

        places = self.create_places()
        tours = self.create_tours(places, guides)
        self.create_bookings(tourists, tours)
        self.create_reviews(tourists, tours)
        self.create_favorites(tourists, tours)
        self.create_chat_messages(tourists)
        self.create_trip_plans(tourists)

        self.stdout.write(self.style.SUCCESS('Демо-данные готовы. Пароль пользователей: ' + DEMO_PASSWORD))

    def create_users(self):
        users = []
        for username, first_name, last_name, role in USERS:
            user = CustomUser.objects.filter(username=username).first()
            if user is None:
                # create_user хеширует пароль
                user = CustomUser.objects.create_user(
                    username=username,
                    password=DEMO_PASSWORD,
                    email=username + '@example.com',
                    first_name=first_name,
                    last_name=last_name,
                    role=role,
                )
            users.append(user)
        return users

    def create_places(self):
        places = []
        for name, city, description, tags in PLACES:
            place, created = Place.objects.get_or_create(
                name=name,
                defaults={'city': city, 'description': description, 'tags': tags},
            )
            places.append(place)
        return places

    def create_tours(self, places, guides):
        tours = []
        today = timezone.localdate()
        number = 0
        for title, description, place_number, guide_number, price, days, max_people in TOURS:
            number = number + 1
            tour, created = Tour.objects.get_or_create(
                title=title,
                defaults={
                    'description': description,
                    'place': places[place_number],
                    'guide': guides[guide_number],
                    # Decimal нужен, чтобы потом умножать цену как число, а не как текст
                    'price': Decimal(price),
                    'days': days,
                    # все туры начинаются в будущем, чтобы их можно было бронировать
                    'start_date': today + timedelta(days=14 + number * 7),
                    'max_people': max_people,
                },
            )
            tours.append(tour)
        return tours

    def create_booking(self, user, tour, people_count, status):
        if not Booking.objects.filter(user=user, tour=tour).exists():
            Booking.objects.create(
                user=user,
                tour=tour,
                people_count=people_count,
                total_price=tour.price * people_count,
                status=status,
            )

    def create_bookings(self, tourists, tours):
        # 10 подтверждённых броней: отзыв можно оставить только с такой бронью
        for number in range(10):
            tourist = tourists[number % 6]
            people_count = number % 3 + 1
            self.create_booking(tourist, tours[number], people_count, 'confirmed')

        # ещё 3 брони, чтобы можно было показать confirm, cancel и все статусы
        self.create_booking(tourists[0], tours[1], 2, 'pending')
        self.create_booking(tourists[1], tours[2], 1, 'pending')
        self.create_booking(tourists[2], tours[3], 1, 'cancelled')

    def create_reviews(self, tourists, tours):
        for number in range(10):
            rating, text = REVIEWS[number]
            Review.objects.get_or_create(
                user=tourists[number % 6],
                tour=tours[number],
                defaults={'rating': rating, 'text': text},
            )

    def create_favorites(self, tourists, tours):
        for number in range(10):
            Favorite.objects.get_or_create(user=tourists[number % 6], tour=tours[9 - number])

    def create_chat_messages(self, tourists):
        for number in range(10):
            question, answer = QUESTIONS[number]
            ChatMessage.objects.get_or_create(
                user=tourists[number % 6],
                question=question,
                defaults={'answer': answer},
            )

    def create_trip_plans(self, tourists):
        for number in range(10):
            city, days, budget, interests = PLANS[number]
            plan = 'Демо-план. День 1: знакомство с городом ' + city + '. Интересы: ' + interests + '.'
            TripPlan.objects.get_or_create(
                user=tourists[number % 6],
                city=city,
                days=days,
                defaults={'budget': budget, 'interests': interests, 'plan': plan},
            )
