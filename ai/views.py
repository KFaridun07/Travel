from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from places.models import Place
from places.serializers import PlaceSerializer
from tours.models import Tour
from tours.serializers import TourSerializer
from .models import ChatMessage
from .serializers import ChatMessageSerializer, PhotoSearchSerializer
from .services import AIServiceError, ask_consultant, recognize_place


def clean_text(value):
    # AI может вернуть что угодно, поэтому берём только непустой текст
    if isinstance(value, str):
        return value.strip().lower()
    return ''


def find_place(recognized):
    places = Place.objects.all()

    # 1. ищем по названию
    name = clean_text(recognized.get('name'))
    if name:
        for place in places:
            place_name = place.name.lower()
            if name in place_name or place_name in name:
                return place

    # 2. если не нашли, ищем по городу
    city = clean_text(recognized.get('city'))
    if city:
        for place in places:
            if city in place.city.lower():
                return place

    # 3. если не нашли, ищем по тегам
    tags = recognized.get('tags')
    if isinstance(tags, list):
        for tag in tags:
            tag = clean_text(tag)
            if tag:
                for place in places:
                    if tag in place.tags.lower():
                        return place

    return None


class PhotoSearchView(generics.GenericAPIView):
    serializer_class = PhotoSearchSerializer
    permission_classes = [permissions.IsAuthenticated]
    # этот парсер нужен, чтобы загружать картинку
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            recognized = recognize_place(serializer.validated_data['image'])
        except AIServiceError as error:
            return Response({'detail': str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # AI вернул не JSON
        if recognized is None:
            return Response(
                {'detail': 'Не удалось распознать место на фото, попробуйте другое фото'},
                status=status.HTTP_502_BAD_GATEWAY
            )

        place = find_place(recognized)

        # в нашей базе такого места нет: показываем, что распознал AI
        if place is None:
            return Response({
                'message': 'Такого места пока нет в нашей базе',
                'recognized': recognized,
            })

        context = {'request': request}
        tours = place.tours.all()
        return Response({
            'recognized': recognized,
            'place': PlaceSerializer(place, context=context).data,
            'tours': TourSerializer(tours, many=True, context=context).data,
        })


class ChatView(generics.GenericAPIView):
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question = serializer.validated_data['question']

        # собираем список наших туров текстом
        tours_text = ''
        for tour in Tour.objects.all():
            tours_text = tours_text + '- ' + tour.title + ', город: ' + tour.place.city
            tours_text = tours_text + ', цена: ' + str(tour.price) + ', дней: ' + str(tour.days) + '\n'
        if tours_text == '':
            tours_text = 'Туров пока нет'

        try:
            answer = ask_consultant(question, tours_text)
        except AIServiceError as error:
            return Response({'detail': str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # сохраняем вопрос и ответ в базу
        serializer.save(user=request.user, answer=answer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ChatHistoryView(generics.ListAPIView):
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Swagger открывает эту страницу без входа, поэтому проверяем пользователя
        if not self.request.user.is_authenticated:
            return ChatMessage.objects.none()
        # каждый видит только свою историю
        return ChatMessage.objects.filter(user=self.request.user)
