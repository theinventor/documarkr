module TailwindHelper
  # Button styles with variants
  # Usage: button_classes(:primary, :sm) or button_classes(:outline)
  def button_classes(*variants)
    base_classes = "inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2"

    # Size variants
    size_classes = case variants.find { |v| [ :xs, :sm, :lg, :xl ].include?(v) }
    when :xs
      "px-2.5 py-1.5 text-xs"
    when :sm
      "px-3 py-1.5 text-sm leading-4"
    when :lg
      "px-5 py-2.5 text-base"
    when :xl
      "px-6 py-3 text-base"
    else
      "px-4 py-2 text-sm" # Default (md) size
    end

    # Style variants
    style_classes = case variants.find { |v| [ :primary, :secondary, :success, :danger, :warning, :info, :dark, :light, :outline, :link ].include?(v) }
    when :primary
      "border border-transparent text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500"
    when :secondary
      "border border-transparent text-white bg-gray-600 hover:bg-gray-700 focus:ring-gray-500"
    when :success
      "border border-transparent text-white bg-green-600 hover:bg-green-700 focus:ring-green-500"
    when :danger
      "border border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500"
    when :warning
      "border border-transparent text-gray-900 bg-yellow-400 hover:bg-yellow-500 focus:ring-yellow-500"
    when :info
      "border border-transparent text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
    when :dark
      "border border-transparent text-white bg-gray-800 hover:bg-gray-900 focus:ring-gray-500"
    when :light
      "border border-transparent text-gray-700 bg-gray-100 hover:bg-gray-200 focus:ring-gray-500"
    when :outline
      "border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-indigo-500"
    when :link
      "border border-transparent text-indigo-600 bg-transparent hover:underline focus:ring-indigo-500 hover:bg-transparent p-0 focus:ring-offset-0"
    else
      "border border-transparent text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500" # Default (:primary) style
    end

    # Combine all classes
    [ base_classes, size_classes, style_classes ].join(" ")
  end

  # Card container styles
  def card_classes
    "bg-white shadow overflow-hidden rounded-lg p-6"
  end

  # Input field styles
  def input_classes
    "appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
  end

  # Label styles
  def label_classes
    "block text-sm font-medium text-gray-700"
  end

  # Form field container
  def form_field_classes
    "mb-4"
  end

  # Table styles
  def table_classes
    "min-w-full divide-y divide-gray-200"
  end

  # Dropdown menu styles
  def dropdown_menu_classes
    "origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
  end

  # Avatar styles with size variants
  def avatar_classes(size = :md)
    base_classes = "inline-flex items-center justify-center rounded-full bg-gray-100"

    size_classes = case size
    when :xs
      "h-6 w-6 text-xs"
    when :sm
      "h-8 w-8 text-sm"
    when :lg
      "h-12 w-12 text-lg"
    when :xl
      "h-16 w-16 text-xl"
    else
      "h-10 w-10 text-base" # Default (md) size
    end

    [ base_classes, size_classes ].join(" ")
  end

  # Badge styles with variants
  def badge_classes(variant = :default)
    base_classes = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"

    variant_classes = case variant
    when :primary
      "bg-indigo-100 text-indigo-800"
    when :success
      "bg-green-100 text-green-800"
    when :danger
      "bg-red-100 text-red-800"
    when :warning
      "bg-yellow-100 text-yellow-800"
    when :info
      "bg-blue-100 text-blue-800"
    when :dark
      "bg-gray-800 text-gray-100"
    when :light
      "bg-gray-100 text-gray-800"
    else
      "bg-gray-100 text-gray-800" # Default style
    end

    [ base_classes, variant_classes ].join(" ")
  end
end
