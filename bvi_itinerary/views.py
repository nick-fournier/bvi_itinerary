from django.shortcuts import render, redirect
import json
import os

# Read routing.json data
DATA_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 'static/stops.json')

with open(DATA_PATH) as f:    
    MAP_DATA = json.load(f)

def itinerary(request, **kwargs):
    
    context = kwargs
    context['map_data'] = json.dumps(MAP_DATA)
    
    return render(request, 'bvi_itinerary.html', context=context)

def index(request):
    return redirect("bvi-itinerary")