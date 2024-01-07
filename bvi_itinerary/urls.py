from django.urls import path

from . import views

urlpatterns = [
    path('bvi-itinerary/', views.itinerary, name='bvi-itinerary'),
    path('', views.index, name='index'),    
]
