namespace chs.integrate360;

service IFlowCompareService @(path: '/odata/v4/iflow') {

  entity Health {
    key ID    : String;
        status: String;
  }

}