// Import and register all your controllers from the importmap under controllers/
import { application } from "./application"

// Eager load all controllers defined in the import map under controllers/**/*_controller
import { eagerLoadControllersFrom } from "@hotwired/stimulus-loading"
eagerLoadControllersFrom("controllers", application)

// Import and register custom controllers
import FinalizeController from "./finalize_controller"
application.register("finalize", FinalizeController)

import SignatureModalController from "./signature_modal_controller"
application.register("signature-modal", SignatureModalController)

// Lazy load controllers as they appear in the DOM (remember not to preload controllers in import map!)
// import { lazyLoadControllersFrom } from "@hotwired/stimulus-loading"
// lazyLoadControllersFrom("controllers", application)
