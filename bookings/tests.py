from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APITestCase
from places.models import Place
from tours.models import Tour
from .models import Booking

User = get_user_model()


class RepeatBookingTests(APITestCase):
    def setUp(self):
        self.tourist = User.objects.create_user('tourist', password='pass', role='tourist')
        self.other = User.objects.create_user('other', password='pass', role='tourist')
        guide = User.objects.create_user('guide', password='pass', role='guide')
        place = Place.objects.create(name='Озеро', city='Айни', description='Описание')
        self.tour = Tour.objects.create(
            title='Тур', description='Описание', place=place, guide=guide, price=100,
            days=2, start_date=timezone.localdate() + timedelta(days=10), max_people=10,
        )
        self.second_tour = Tour.objects.create(
            title='Другой тур', description='Описание', place=place, guide=guide, price=100,
            days=2, start_date=timezone.localdate() + timedelta(days=10), max_people=10,
        )

    def book(self, user, tour):
        self.client.force_authenticate(user)
        return self.client.post('/api/bookings/', {'tour': tour.id, 'people_count': 1}, format='json')

    def test_same_tour_twice_is_refused(self):
        self.assertEqual(self.book(self.tourist, self.tour).status_code, 201)
        response = self.book(self.tourist, self.tour)
        self.assertEqual(response.status_code, 400)
        self.assertIn('Вы уже забронировали этот тур', str(response.data))
        self.assertEqual(Booking.objects.filter(user=self.tourist).count(), 1)

    def test_confirmed_booking_also_blocks_repeat(self):
        Booking.objects.create(user=self.tourist, tour=self.tour, people_count=1, total_price=100, status='confirmed')
        self.assertEqual(self.book(self.tourist, self.tour).status_code, 400)

    def test_can_book_again_after_cancel(self):
        booking_id = self.book(self.tourist, self.tour).data['id']
        self.assertEqual(self.client.post('/api/bookings/' + str(booking_id) + '/cancel/', {}, format='json').status_code, 200)
        self.assertEqual(self.book(self.tourist, self.tour).status_code, 201)
        # и снова повторить нельзя
        self.assertEqual(self.book(self.tourist, self.tour).status_code, 400)

    def test_other_tour_and_other_tourist_are_allowed(self):
        self.assertEqual(self.book(self.tourist, self.tour).status_code, 201)
        self.assertEqual(self.book(self.tourist, self.second_tour).status_code, 201)
        self.assertEqual(self.book(self.other, self.tour).status_code, 201)

    def test_database_refuses_duplicate(self):
        Booking.objects.create(user=self.tourist, tour=self.tour, people_count=1, total_price=100)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Booking.objects.create(user=self.tourist, tour=self.tour, people_count=1, total_price=100)
