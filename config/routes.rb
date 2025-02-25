Rails.application.routes.draw do
  devise_for :users

  resources :documents do
    member do
      get :download
    end
    resources :document_signers, only: [ :new, :create, :destroy, :index ]
    resources :form_fields, only: [ :create, :update, :destroy, :index ] do
      collection do
        post :debug_click
      end
    end

    # Document signing routes
    get "sign/:token", to: "documents#sign", as: "sign"
    post "sign", to: "documents#sign_complete"
    get "complete", to: "documents#complete", as: "complete"

    # Form field completion
    post "form_fields/:field_id/complete", to: "documents#complete_field", as: "complete_field"
  end

  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Defines the root path route ("/")
  root "documents#index"
end
