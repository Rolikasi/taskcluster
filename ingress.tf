locals {
  ingress_context = {
    disabled_services = "${var.disabled_services}"
  }
}

data "jsone_template" "taskcluster_ingress" {
  template     = "${file("${path.module}/ingress.yaml")}"
  yaml_context = "${jsonencode(local.ingress_context)}"
}

resource "k8s_manifest" "taskcluster_ingress" {
  content = "${data.jsone_template.taskcluster_ingress.rendered}"
}

# TODO: https://github.com/kubernetes/ingress-gce#backend-https


# TODO: Set up service accounts for ingress!

