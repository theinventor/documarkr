require "test_helper"

class DocumentsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @document = documents(:one)
  end

  test "index requires authentication" do
    get documents_url
    assert_redirected_to new_user_session_url
  end

  test "show requires authentication" do
    get document_url(@document)
    assert_redirected_to new_user_session_url
  end

  test "new requires authentication" do
    get new_document_url
    assert_redirected_to new_user_session_url
  end

  test "create requires authentication" do
    post documents_url, params: { document: { title: "Test document" } }
    assert_redirected_to new_user_session_url
  end

  test "edit requires authentication" do
    get edit_document_url(@document)
    assert_redirected_to new_user_session_url
  end

  test "update requires authentication" do
    patch document_url(@document), params: { document: { title: "Updated document" } }
    assert_redirected_to new_user_session_url
  end

  test "destroy requires authentication" do
    delete document_url(@document)
    assert_redirected_to new_user_session_url
  end
end
