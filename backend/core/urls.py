from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView



def home(request):
    return HttpResponse("Backend is running 🚀")

urlpatterns = [
    path('', home),
    path('admin/', admin.site.urls),

    # JWT endpoints
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # API endpoints
    path('api/', include('api.urls')),
]
