require "test_helper"

class PublicSigningControllerTest < ActionDispatch::IntegrationTest
  test "show redirects an invalid signing link" do
    get public_sign_document_url(id: -1, token: "missing")
    assert_redirected_to root_url
  end

  test "sign complete redirects an invalid signing link" do
    post public_sign_complete_url(id: -1), params: { token: "missing" }
    assert_redirected_to root_url
  end

  test "complete redirects an invalid document" do
    get public_sign_complete_view_url(id: -1)
    assert_redirected_to root_url
  end
end
