from django.urls import path
from . import views


urlpatterns = [
    path("hello/", views.hello_world),

    # Auth endpoints
    path('auth/register/', views.RegisterView.as_view(), name='auth_register'),
    path('auth/login/', views.LoginView.as_view(), name='auth_login'),  # JWT login
    path('auth/refresh/', views.TokenRefreshView.as_view(), name='token_refresh'),

    # User CRUD endpoints
    # path('users/', views.UserListCreateView.as_view(), name='user_list_create'),
    # path('users/<int:pk>/', views.UserRetrieveUpdateDeleteView.as_view(), name='user_detail'),
]
