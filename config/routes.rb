Rails.application.routes.draw do
  devise_for :users

  # Mount letter_opener web interface in development
  if Rails.env.development?
    mount LetterOpenerWeb::Engine, at: "/letter_opener"
  end

  # Public document signing routes (no authentication required)
  get "sign/:id/:token", to: "public_signing#show", as: "public_sign_document"
  post "sign/:id", to: "public_signing#sign_complete", as: "public_sign_complete"
  get "sign/:id/complete", to: "public_signing#complete", as: "public_sign_complete_view"
  post "sign/:id/form_fields/:field_id/complete", to: "public_signing#complete_field", as: "public_complete_field"

  resources :documents do
    member do
      get :download
      post :send_to_signers
      post :resend_signing_email, path: "signers/:signer_id/resend"
    end
    resources :document_signers, only: [ :new, :create, :destroy, :index ]
    resources :form_fields, only: [ :create, :update, :destroy, :index ] do
      collection do
        post :debug_click
      end
    end

    # Form field completion
    # post "form_fields/:field_id/complete", to: "documents#complete_field", as: "complete_field"
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
