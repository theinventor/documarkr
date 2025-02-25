class DocumentsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_document, only: [ :show, :edit, :update, :destroy, :download ]
  before_action :authorize_document, only: [ :edit, :update, :destroy ]

  def index
    @active_documents = current_user.created_documents.active.order(created_at: :desc)
    @completed_documents = current_user.created_documents.inactive.order(created_at: :desc)
    @documents_to_sign = current_user.documents_to_sign.pending.order(created_at: :desc)
  end

  def show
    @document.log_activity(current_user, "viewed", request)
    respond_to do |format|
      format.html
      format.pdf { redirect_to rails_blob_url(@document.file) if @document.file.attached? }
    end
  end

  def new
    @document = Document.new
  end

  def create
    @document = Document.new(document_params)
    @document.creator = current_user
    @document.status = :draft

    if @document.save
      @document.log_activity(current_user, "created", request)
      redirect_to edit_document_path(@document), notice: "Document created successfully."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @document.update(document_params)
      @document.log_activity(current_user, "updated", request)
      redirect_to document_path(@document), notice: "Document updated successfully."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @document.log_activity(current_user, "deleted", request)
    @document.destroy
    redirect_to documents_path, notice: "Document was deleted."
  end

  def download
    if @document.completed_file.attached?
      redirect_to rails_blob_url(@document.completed_file)
    elsif @document.file.attached?
      redirect_to rails_blob_url(@document.file)
    else
      redirect_to @document, alert: "No file available for download."
    end
  end

  private

  def set_document
    @document = Document.find(params[:id])
  end

  def authorize_document
    unless @document.editable_by?(current_user)
      redirect_to documents_path, alert: "You are not authorized to edit this document."
    end
  end

  def document_params
    params.require(:document).permit(:title, :message, :file)
  end
end
