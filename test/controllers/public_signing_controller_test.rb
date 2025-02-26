require "test_helper"

class PublicSigningControllerTest < ActionDispatch::IntegrationTest
  test "should get show" do
    get public_signing_show_url
    assert_response :success
  end

  test "should get sign_complete" do
    get public_signing_sign_complete_url
    assert_response :success
  end

  test "should get complete" do
    get public_signing_complete_url
    assert_response :success
  end
end
