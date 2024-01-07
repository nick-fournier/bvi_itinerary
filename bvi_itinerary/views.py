from django.shortcuts import render
import json
import os

# Read routing.json data
DATA_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 'fixtures/stops.json')

with open(DATA_PATH) as f:    
    MAP_DATA = json.load(f)

def index(request, **kwargs):
    
    context = kwargs
    context['map_data'] = json.dumps(MAP_DATA)
    
    return render(request, 'bvi_itinerary.html', context=context)
